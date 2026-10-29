# Rebuilds the web app, syncs it into the Android project, and builds a debug APK.
# Usage (from the project folder):  .\build-apk.ps1
Set-Location $PSScriptRoot
# Check exit codes rather than using ErrorActionPreference=Stop: npm writes harmless notices to stderr.
function Assert-Ok($step) { if ($LASTEXITCODE -ne 0) { Write-Host "$step failed" -ForegroundColor Red; exit 1 } }

# Gradle 8.14 needs JDK 21 (Android Studio's bundled JDK 25 is too new for it).
$env:JAVA_HOME = "$HOME\.jdks\jbr-21.0.11"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
# Avoid "Unable to establish loopback connection": use a plain temp path, not the 8.3 short name.
$env:TEMP = "$env:LOCALAPPDATA\Temp"
$env:TMP = $env:TEMP
$env:JAVA_TOOL_OPTIONS = "-Djdk.net.unixdomain.tmpdir=$env:PUBLIC"

npm run build; Assert-Ok 'Web build'
npx cap sync android; Assert-Ok 'Capacitor sync'
Push-Location android
.\gradlew.bat assembleDebug; $code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { Write-Host 'Gradle build failed' -ForegroundColor Red; exit 1 }

$apk = Join-Path $PSScriptRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
Write-Host "`nAPK ready: $apk" -ForegroundColor Green
