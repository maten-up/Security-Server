@echo off
cd /d "%~dp0"
where node >nul 2>&1 || (echo Install Node.js 22.12+ & pause & exit /b 1)
if not exist .env (
 copy .env.example .env >nul
 echo Configure .env first. On Windows set PYTHON_BIN=python if needed.
 pause
 exit /b 0
)
if not exist node_modules call npm install --ignore-scripts
if errorlevel 1 (pause & exit /b 1)
call npm start
pause
