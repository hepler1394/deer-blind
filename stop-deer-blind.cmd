@echo off
rem  Deer Blind - stop the gateway and console server (leaves Ollama running).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-blind.ps1"
