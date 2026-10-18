@echo off
rem ============================================================
rem  One-click deploy: <repo>
rem  -> %APPDATA%\poi\plugins-extra\node_modules\poi-plugin-noro6-export-ng
rem
rem  Keep this file ASCII-only so cmd.exe never mis-parses it;
rem  all Chinese messages are printed by deploy.mjs itself.
rem
rem  Runtime discovery order:
rem    1. node.exe in PATH
rem    2. %ProgramFiles%\nodejs\node.exe           (installed, PATH not refreshed)
rem    3. %LOCALAPPDATA%\Programs\nodejs\node.exe
rem    4. %POI_HOME%\poi.exe run as Node           (poi bundles Electron = Node)
rem       e.g.  set POI_HOME=H:\poi
rem ============================================================
setlocal
chcp 65001 >nul 2>&1
cd /d "%~dp0.."

echo.
echo ==========================================
echo   poi-plugin-noro6-export-ng  -  deploy
echo ==========================================
echo.

set "RUNTIME="
set "RUNASNODE="

"%SystemRoot%\System32\where.exe" node >nul 2>&1
if not errorlevel 1 set "RUNTIME=node"

if not defined RUNTIME if exist "%ProgramFiles%\nodejs\node.exe" set "RUNTIME=%ProgramFiles%\nodejs\node.exe"
if not defined RUNTIME if defined ProgramW6432 if exist "%ProgramW6432%\nodejs\node.exe" set "RUNTIME=%ProgramW6432%\nodejs\node.exe"
if not defined RUNTIME if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "RUNTIME=%LOCALAPPDATA%\Programs\nodejs\node.exe"

rem Last resort: borrow the runtime that ships inside poi (Electron in Node mode).
if not defined RUNTIME if defined POI_HOME if exist "%POI_HOME%\poi.exe" (
  set "RUNTIME=%POI_HOME%\poi.exe"
  set "RUNASNODE=1"
)

if not defined RUNTIME goto :no_runtime
if defined RUNASNODE set "ELECTRON_RUN_AS_NODE=1"

echo    runtime: %RUNTIME%
if defined RUNASNODE echo    note: Electron may print a crashpad warning - harmless, ignore it

rem Script uses rmSync (Node 14.14+); require 16+ before touching the plugin directory.
"%RUNTIME%" -e "process.exit(+process.versions.node.split('.')[0]>=16?0:1)" >nul 2>&1
if errorlevel 1 (
  echo.
  echo [ERROR] Node.js 16 or newer is required, but the runtime above is older.
  goto :fail
)

"%RUNTIME%" "scripts\deploy.mjs"
if errorlevel 1 goto :fail

rem Use absolute paths for Windows tools: plain "find" would resolve to
rem Git Bash's find when the script is launched from a POSIX shell.
tasklist /FI "IMAGENAME eq poi.exe" /NH 2>nul | "%SystemRoot%\System32\findstr.exe" /i /c:"poi.exe" >nul
if not errorlevel 1 (
  echo.
  echo [!] poi.exe is running - fully restart poi to load the new build.
)

echo.
echo Done.
goto :ok

:no_runtime
echo [ERROR] No Node.js runtime found.
echo.
echo   Looked for: node in PATH, %%ProgramFiles%%\nodejs, %%LOCALAPPDATA%%\Programs\nodejs.
echo.
echo   Fix either way:
echo     1. Install Node.js 20+ from https://nodejs.org/ , then run this file again
echo     2. Reuse the runtime that ships with poi:
echo          set POI_HOME=^<poi install dir^>       e.g. set POI_HOME=H:\poi
echo          scripts\deploy.bat
goto :fail

:fail
echo.
echo [ERROR] Deploy failed. Read the messages above.
set "RC=1"
goto :pause_and_exit

:ok
set "RC=0"

:pause_and_exit
rem Keep the window open only when this script was double-clicked.
if /i "%~1"=="--no-pause" exit /b %RC%
echo %cmdcmdline% | "%SystemRoot%\System32\findstr.exe" /i /c:"%~nx0" >nul
if not errorlevel 1 pause
exit /b %RC%
