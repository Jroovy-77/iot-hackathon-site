@echo off
REM Step 1 for idea v2: moves the v1 web work into _archive\boat-button-v1
REM and puts the new idea files (_v2-new) into docs\. Run once.
cd /d "%~dp0"
set "A=_archive\boat-button-v1"
if exist "%A%" (
  echo %A% already exists. Nothing was moved.
  pause
  exit /b 0
)
if not exist "_v2-new\docs\idea.md" (
  echo Missing _v2-new\docs\idea.md - ask the chat to send the files again.
  pause
  exit /b 1
)
mkdir "%A%\docs" "%A%\prompts"

echo [1/5] dashboard -^> archive (team 1 builds a new one)
move "dashboard" "%A%\dashboard" >nul
mkdir "dashboard"

echo [2/5] exploded -^> backup copy (team 2 keeps working on the original)
robocopy "exploded" "%A%\exploded" /E /XD vendor _shots /NFL /NDL /NJH /NJS /NP >nul

echo [3/5] old docs -^> archive
for %%F in (idea.md parts.md data-contract.md) do if exist "docs\%%F" move "docs\%%F" "%A%\docs\" >nul
move "docs\test-run-*.md" "%A%\docs\" >nul 2>nul
if exist "docs\img" move "docs\img" "%A%\docs\img" >nul

echo [4/5] old prompts and launchers -^> archive
for %%N in (team1-dashboard team1-fix team1-ui team2-exploded team2-finale team2-fix team2-model team2-try) do (
  if exist "prompts\%%N.md" move "prompts\%%N.md" "%A%\prompts\" >nul
  if exist "run-%%N.bat" move "run-%%N.bat" "%A%\prompts\" >nul
)

echo [5/5] new idea files -^> docs
move /Y "_v2-new\docs\*.md" "docs\" >nul
rmdir /S /Q "_v2-new"

echo.
if exist "exploded\_shots" (
  choice /C YN /M "Delete old screenshots in exploded\_shots to free disk space"
  if not errorlevel 2 rmdir /S /Q "exploded\_shots"
)
echo.
echo Done. Next: double-click run-team1-v2.bat
pause
