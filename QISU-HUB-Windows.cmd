@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 launch.py %*
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo 请先安装 Python 3.10 或更新版本，再重新打开此文件。
    echo 下载地址：https://www.python.org/downloads/
  ) else (
    python launch.py %*
  )
)
pause
