@echo off
REM Copies team roles, settings and the design skill into this project's .claude folder.
REM Claude cannot write into .claude remotely, so this one step is yours.
cd /d "%~dp0"
if not exist ".claude\agents" mkdir ".claude\agents"
if not exist ".claude\skills" mkdir ".claude\skills"
copy /Y "_setup\settings.json" ".claude\settings.json" >nul
copy /Y "_setup\agents\*.md" ".claude\agents\" >nul
if exist "_setup\skills" xcopy /E /I /Y /Q "_setup\skills" ".claude\skills" >nul
echo.
echo Installed roles:
dir /b ".claude\agents"
echo Installed skills:
dir /b ".claude\skills"
echo.
echo Done. Close any open Claude Code windows first, then use run-solo.bat or a run-*.bat file.
pause
