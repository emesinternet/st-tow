@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
powershell.exe -NoLogo -NoExit -ExecutionPolicy Bypass -File "%SCRIPT_DIR%launch-local-windows.ps1" %*
endlocal
