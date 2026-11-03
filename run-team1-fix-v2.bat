@echo off
cd /d "%~dp0"
set "CLAUDE_EXE=claude"
where claude >nul 2>nul || set "CLAUDE_EXE=%USERPROFILE%\.local\bin\claude.exe"
"%CLAUDE_EXE%" --model sonnet --effort medium "Read the file prompts/team1-fix-v2.md and carry it out exactly. Talk to me in Thai."
pause
