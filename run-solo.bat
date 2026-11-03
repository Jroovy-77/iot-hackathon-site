@echo off
REM Solo mode: one Claude Code session, agent teams switched off. For small fixes.
cd /d "%~dp0"
set "CLAUDE_EXE=claude"
where claude >nul 2>nul || set "CLAUDE_EXE=%USERPROFILE%\.local\bin\claude.exe"
"%CLAUDE_EXE%" --model sonnet --effort medium --settings "_setup\solo-settings.json" "Solo mode: do the work yourself, never create an agent team. Ask me what to change first. Talk to me in Thai."
pause
