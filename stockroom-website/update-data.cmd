@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  echo 請先安裝 Python 3.12 或以上，並啟用 Python Launcher，再重新執行。
  pause
  exit /b 1
)
if not exist ".venv\Scripts\python.exe" py -3 -m venv .venv
if errorlevel 1 goto failed
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto failed
".venv\Scripts\python.exe" update_data.py
if errorlevel 1 goto failed
echo 更新完成！重新開啟 index.html 或按「重新讀取」查看行情。
pause
exit /b 0
:failed
echo 更新未完成。請查看上方訊息；舊行情會保留，不會換成模擬數字。
pause
exit /b 1
