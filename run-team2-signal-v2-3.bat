@echo off
cd /d "%~dp0"
set "CLAUDE_EXE=claude"
where claude >nul 2>nul || set "CLAUDE_EXE=%USERPROFILE%\.local\bin\claude.exe"
"%CLAUDE_EXE%" --model sonnet --effort medium "Read the file prompts/team2-signal-v2-3.md and carry it out exactly. Talk to me in Thai."
pause
