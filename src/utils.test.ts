// utils.test.ts — the pure helpers, pinned down.
// Run with `npm test` (vitest, node environment — nothing here needs a DOM).
import { describe, it, expect } from 'vitest';
import { esc, fmtTok, fmtBytes, fmtDur, fmtAgo, mediaKind, md, stripThink, crc32, makeZip, mulberry } from './utils';

describe('esc', () => {
  it('escapes every HTML-special character', () => {
    expect(esc(`<img src=x onerror="pwn('&')">`))
      .toBe('&lt;img src=x onerror=&quot;pwn(&#39;&amp;&#39;)&quot;&gt;');
  });
  it('stringifies non-strings instead of throwing', () => {
    expect(esc(42)).toBe('42');
    expect(esc(null)).toBe('null');
  });
});

describe('formatters', () => {
  it('fmtTok picks sensible units', () => {
    expect(fmtTok(999)).toBe('999');
    expect(fmtTok(1500)).toBe('1.5k');
    expect(fmtTok(20000)).toBe('20k');       // trailing .0 dropped
    expect(fmtTok(2_400_000)).toBe('2.4M');
  });
  it('fmtBytes crosses KB and MB boundaries', () => {
    expect(fmtBytes(512)).toBe('512 B');
    expect(fmtBytes(1024)).toBe('1.0 KB');
    expect(fmtBytes(1048576)).toBe('1.0 MB');
  });
  it('fmtDur renders seconds and minutes', () => {
    expect(fmtDur(9_000)).toBe('9s');
    expect(fmtDur(61_000)).toBe('1m 01s');   // zero-padded seconds
  });
  it('fmtAgo buckets by age', () => {
    const now = Date.now();
    expect(fmtAgo(now - 5_000)).toBe('just now');
    expect(fmtAgo(now - 120_000)).toBe('2m ago');
    expect(fmtAgo(now - 7_200_000)).toBe('2h ago');
    expect(fmtAgo(now - 172_800_000)).toBe('2d ago');
  });
});

describe('mediaKind', () => {
  it('sniffs images and videos by extension, case-insensitive', () => {
    expect(mediaKind('shot.PNG')).toBe('img');
    expect(mediaKind('frames/frame_01.jpg')).toBe('img');
    expect(mediaKind('clip.mp4')).toBe('video');
    expect(mediaKind('clip.MOV')).toBe('video');
  });
  it('says null for everything else', () => {
    expect(mediaKind('report.md')).toBeNull();
    expect(mediaKind('no-extension')).toBeNull();
    expect(mediaKind('archive.tar.gz')).toBeNull();
  });
});

describe('stripThink', () => {
  it('pulls a closed think block out of the message', () => {
    const r = stripThink('<think>chew on it</think>The answer is 4.');
    expect(r.text).toBe('The answer is 4.');
    expect(r.think).toBe('chew on it');
  });
  it('handles an unterminated think block (mid-stream)', () => {
    const r = stripThink('<think>still going');
    expect(r.text).toBe('');
    expect(r.think).toBe('still going');
  });
  it('concatenates multiple think blocks', () => {
    const r = stripThink('<think>a</think>x<think>b</think>y');
    expect(r.text).toBe('xy');
    expect(r.think).toContain('a');
    expect(r.think).toContain('b');
  });
  it('leaves plain text alone', () => {
    expect(stripThink('just words')).toEqual({ text: 'just words', think: '' });
  });
});

describe('md', () => {
  it('renders headings, bold, code and links', () => {
    const h = md('## Title\n\nSome **bold** and `code` and [a link](https://example.com).');
    expect(h).toContain('<h2>Title</h2>');
    expect(h).toContain('<strong>bold</strong>');
    expect(h).toContain('<code>code</code>');
    expect(h).toContain('<a href="https://example.com" target="_blank" rel="noopener">a link</a>');
  });
  it('renders bulleted and numbered lists', () => {
    expect(md('- one\n- two')).toContain('<ul><li>one</li><li>two</li></ul>');
    expect(md('1. first\n2. second')).toContain('<ol><li>first</li><li>second</li></ol>');
  });
  it('renders a pipe table with header and rows', () => {
    const h = md('| a | b |\n|---|---|\n| 1 | 2 |');
    expect(h).toContain('<th>a</th>');
    expect(h).toContain('<td>2</td>');
  });
  it('keeps code fences verbatim and escaped', () => {
    const h = md('```js\nconst x = "<b>";\n```');
    expect(h).toContain('<pre><code>');
    expect(h).toContain('&lt;b&gt;');
    expect(h).not.toContain('<b>');
  });
  it('escapes raw HTML in prose (no injection through messages)', () => {
    expect(md('hello <script>alert(1)</script>')).not.toContain('<script>');
  });
});

describe('crc32', () => {
  it('matches the published check value for "123456789"', () => {
    const b = new TextEncoder().encode('123456789');
    expect(crc32(b)).toBe(0xCBF43926);       // the canonical CRC-32 test vector
  });
  it('empty input yields 0', () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe('makeZip', () => {
  it('produces a structurally sound store-only zip', async () => {
    const zip = makeZip([
      { name: 'a.txt', data: 'alpha' },
      { name: 'dir/b.txt', data: 'bravo' },
    ]);
    const buf = new Uint8Array(await zip.arrayBuffer());
    const u32 = (o: number) => buf[o] | (buf[o+1]<<8) | (buf[o+2]<<16) | (buf[o+3]<<24);
    const u16 = (o: number) => buf[o] | (buf[o+1]<<8);
    // local file header magic at offset 0
    expect(u32(0) >>> 0).toBe(0x04034b50);
    // end-of-central-directory magic in the last 22 bytes, entry count = 2
    const eocd = buf.length - 22;
    expect(u32(eocd) >>> 0).toBe(0x06054b50);
    expect(u16(eocd + 10)).toBe(2);
    // first entry's stored CRC matches an independent computation
    expect(u32(14) >>> 0).toBe(crc32(new TextEncoder().encode('alpha')));
    // payloads travel uncompressed, so the bytes are right there
    const text = new TextDecoder().decode(buf);
    expect(text).toContain('alpha');
    expect(text).toContain('bravo');
    expect(text).toContain('dir/b.txt');
  });
});

describe('mulberry', () => {
  it('is deterministic for a given seed and in [0,1)', () => {
    const a = mulberry(42), b = mulberry(42);
    const seqA = [a(), a(), a()], seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
    seqA.forEach(v => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); });
    expect(mulberry(43)()).not.toBe(mulberry(42)());
  });
});
