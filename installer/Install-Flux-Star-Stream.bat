@echo off
setlocal EnableExtensions
title Flux Star Stream - Dependency Setup

echo.
echo  Flux Star Stream Setup
echo  ----------------------
echo  This script installs/configures Spicetify and the Flux bridge extension.
echo.

set "BRIDGE_SOURCE=%~dp0fluxBridge.js"
if not exist "%BRIDGE_SOURCE%" if exist "%~dp0resources\fluxBridge.js" set "BRIDGE_SOURCE=%~dp0resources\fluxBridge.js"

if not exist "%BRIDGE_SOURCE%" (
    echo ERROR: fluxBridge.js was not found beside this BAT file or in resources\.
    echo Include fluxBridge.js with the built application.
    pause
    exit /b 1
)

where powershell.exe >nul 2>&1
if errorlevel 1 (
    echo ERROR: Windows PowerShell is required but was not found.
    pause
    exit /b 1
)

echo Checking for Spotify...
if not exist "%APPDATA%\Spotify\Spotify.exe" if not exist "%LOCALAPPDATA%\Microsoft\WindowsApps\Spotify.exe" (
    echo.
    echo WARNING: Spotify was not found in the usual locations.
    echo Install and sign in to the official Spotify desktop app before continuing.
    echo Download: https://www.spotify.com/download/windows/
    echo.
    choice /C YN /M "Continue anyway"
    if errorlevel 2 exit /b 1
)

echo.
echo Installing Spicetify if needed...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
 "$ErrorActionPreference='Stop';" ^
 "$cmd=Get-Command spicetify -ErrorAction SilentlyContinue;" ^
 "if (-not $cmd) {" ^
 "  Write-Host 'Downloading and running the official Spicetify installer...';" ^
 "  $installer=Join-Path $env:TEMP 'spicetify-install.ps1';" ^
 "  Invoke-WebRequest 'https://raw.githubusercontent.com/spicetify/cli/main/install.ps1' -OutFile $installer;" ^
 "  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer;" ^
 "  if ($LASTEXITCODE -ne 0) { throw 'Spicetify installer returned an error.' }" ^
 "};" ^
 "$candidates=@((Join-Path $env:LOCALAPPDATA 'spicetify\spicetify.exe'),(Join-Path $env:APPDATA 'spicetify\spicetify.exe'));" ^
 "$sp=$null;" ^
 "foreach($p in $candidates){if(Test-Path $p){$sp=$p;break}};" ^
 "if(-not $sp){$cmd=Get-Command spicetify -ErrorAction SilentlyContinue;if($cmd){$sp=$cmd.Source}};" ^
 "if(-not $sp){throw 'Spicetify was not found after installation. Close and reopen this script, then try again.'};" ^
 "Write-Host ('Using Spicetify: '+$sp);" ^
 "$env:FLUX_SPICETIFY=$sp" 
if errorlevel 1 (
    echo.
    echo ERROR: Spicetify installation failed.
    echo Check your internet connection, then retry. If it was just installed, close and reopen this BAT.
    pause
    exit /b 1
)

rem Resolve the Spicetify executable again for the remaining commands.
set "SPICETIFY_EXE="
for %%P in ("%LOCALAPPDATA%\spicetify\spicetify.exe" "%APPDATA%\spicetify\spicetify.exe") do (
    if exist "%%~P" set "SPICETIFY_EXE=%%~P"
)
if not defined SPICETIFY_EXE (
    for /f "delims=" %%P in ('where spicetify.exe 2^>nul') do if not defined SPICETIFY_EXE set "SPICETIFY_EXE=%%P"
)
if not defined SPICETIFY_EXE (
    echo.
    echo ERROR: Could not locate spicetify.exe after installation.
    echo Close and reopen this BAT and try again.
    pause
    exit /b 1
)

set "EXT_DIR=%APPDATA%\spicetify\Extensions"
if not exist "%EXT_DIR%" mkdir "%EXT_DIR%"
if errorlevel 1 (
    echo ERROR: Could not create the Spicetify Extensions folder.
    pause
    exit /b 1
)

echo.
echo Installing fluxBridge.js...
copy /Y "%BRIDGE_SOURCE%" "%EXT_DIR%\fluxBridge.js" >nul
if errorlevel 1 (
    echo ERROR: Could not copy fluxBridge.js to "%EXT_DIR%".
    pause
    exit /b 1
)


rem Refuse to apply an old bridge bundled inside an outdated app build.
findstr /C:"const BRIDGE_BUILD = 'search-results-v3';" "%EXT_DIR%\fluxBridge.js" >nul
if errorlevel 1 (
    echo.
    echo ERROR: This Star Stream installer contains an outdated fluxBridge.js.
    echo Pull the latest fix/search-results-v2 branch, rebuild the app, then run this installer again.
    pause
    exit /b 1
)

echo.
echo Registering the extension without removing other configured extensions...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
 "$ErrorActionPreference='Stop';" ^
 "$cfg=Join-Path $env:APPDATA 'spicetify\config-xpui.ini';" ^
 "if(-not (Test-Path $cfg)){ $cfg=Join-Path $env:APPDATA 'spicetify\config.ini' };" ^
 "if(-not (Test-Path $cfg)){ throw 'Spicetify config file was not found. Run spicetify once, then retry.' };" ^
 "$raw=Get-Content -LiteralPath $cfg -Raw;" ^
 "$pattern='(?m)^(\s*extensions\s*=\s*)(.*)$';" ^
 "if($raw -notmatch $pattern){ $raw += [Environment]::NewLine+'extensions = fluxBridge.js'+[Environment]::NewLine }" ^
 "else {" ^
 "  $line=[regex]::Match($raw,$pattern).Groups[2].Value.Trim();" ^
 "  if($line -notmatch '(^|\|)fluxBridge\.js(\||$)') {" ^
 "    $value=$line.Trim('""',' ');" ^
 "    if([string]::IsNullOrWhiteSpace($value)){$value='fluxBridge.js'}else{$value=$value.TrimEnd('|')+'|fluxBridge.js'};" ^
 "    $raw=[regex]::Replace($raw,$pattern,('$1'+$value),1)" ^
 "  }" ^
 "};" ^
 "Set-Content -LiteralPath $cfg -Value $raw -Encoding UTF8"
if errorlevel 1 (
    echo.
    echo ERROR: Could not update the Spicetify configuration.
    echo The extension file was copied, but it may need to be enabled manually.
    pause
    exit /b 1
)

echo.
echo Applying Spicetify changes...
"%SPICETIFY_EXE%" apply
if errorlevel 1 (
    echo.
    echo ERROR: Spicetify apply failed.
    echo The extension was copied and registered, but Spotify may need troubleshooting.
    echo Try running: spicetify backup apply
    pause
    exit /b 1
)

echo.
echo SUCCESS: Spicetify is installed and fluxBridge.js build search-results-v3 is configured.
echo Restart Spotify if it is already running, then launch Flux Star Stream.
echo.
pause
exit /b 0
