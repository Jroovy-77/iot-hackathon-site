@echo off
chcp 65001 >nul
cd /d "%~dp0"

rem ถ้ามี preview เปิดอยู่แล้ว (port 8000) ไม่ต้องเปิดซ้ำ แค่เปิด browser
netstat -ano | findstr /r /c:"127\.0\.0\.1:8000 .*LISTENING" >nul
if not errorlevel 1 (
  echo preview เปิดอยู่แล้ว กำลังเปิด browser ไปที่ http://127.0.0.1:8000/
  start http://127.0.0.1:8000/
  exit /b 0
)

where python >nul 2>nul
if errorlevel 1 (
  echo [x] ไม่พบ python ในเครื่อง ติดตั้ง Python 3 ก่อน แล้วลองใหม่
  pause
  exit /b 1
)

echo เปิดเว็บที่ http://127.0.0.1:8000/
echo ปิดหน้าต่างนี้ หรือกด Ctrl+C เพื่อหยุด
start "" /b cmd /c "ping -n 2 127.0.0.1 >nul & start http://127.0.0.1:8000/"
python -m http.server 8000 --bind 127.0.0.1
if errorlevel 1 (
  echo.
  echo [x] เปิดเซิร์ฟเวอร์ไม่ได้ ลองปิดโปรแกรมอื่นที่ใช้ port 8000 แล้วเปิดใหม่
  pause
)
