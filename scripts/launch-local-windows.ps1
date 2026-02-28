[CmdletBinding()]
param(
  [string]$DatabaseName = '',
  [switch]$FirstRunChecks,
  [switch]$StopOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptVersion = '2026-02-28.wsl-launcher.1'

$Config = [ordered]@{
  DistroName      = 'Ubuntu'
  RepoLinuxPath   = '/home/tsuda/repos/st-tow'
  ScriptsLinuxPath = '/home/tsuda/repos/st-tow/scripts/local'
  ListenHost      = '127.0.0.1'
  SpacetimePort   = 3000
  WebPort         = 5173
}

function Quote-PS {
  param([Parameter(Mandatory = $true)][string]$Value)
  return "'" + $Value.Replace("'", "''") + "'"
}

function Start-PowerShellWindow {
  param([Parameter(Mandatory = $true)][string]$CommandText)

  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($CommandText))
  Start-Process -FilePath 'powershell.exe' -ArgumentList @(
    '-NoLogo',
    '-NoExit',
    '-ExecutionPolicy', 'Bypass',
    '-EncodedCommand', $encoded
  ) -WorkingDirectory $env:SystemRoot | Out-Null
}

function Test-WslDistroExists {
  param([Parameter(Mandatory = $true)][string]$Name)

  $distros = & wsl.exe -l -q 2>$null
  if (-not $distros) {
    return $false
  }

  foreach ($d in $distros) {
    if ($d.Trim() -eq $Name) {
      return $true
    }
  }

  return $false
}

function Invoke-WslBash {
  param(
    [Parameter(Mandatory = $true)][string]$Distro,
    [Parameter(Mandatory = $true)][string]$Command
  )

  $output = & wsl.exe -d $Distro -e bash -lc $Command 2>&1
  $exitCode = $LASTEXITCODE

  if ($null -ne $output) {
    foreach ($line in @($output)) {
      Write-Host $line
    }
  }

  return [int]$exitCode
}

function Run-FirstRunChecks {
  param([System.Collections.IDictionary]$Cfg)

  Write-Host "Launcher version: $ScriptVersion" -ForegroundColor Cyan
  Write-Host "Target distro: $($Cfg.DistroName)" -ForegroundColor DarkCyan
  Write-Host "Repo path: $($Cfg.RepoLinuxPath)" -ForegroundColor DarkCyan

  if (-not (Test-WslDistroExists -Name $Cfg.DistroName)) {
    Write-Error "WSL distro '$($Cfg.DistroName)' not found. Run: wsl -l -v"
    return
  }

  $doctorCmd = "'$($Cfg.ScriptsLinuxPath)/doctor.sh' '$($Cfg.RepoLinuxPath)'"
  $rc = Invoke-WslBash -Distro $Cfg.DistroName -Command $doctorCmd
  if ($rc -ne 0) {
    Write-Error 'WSL doctor checks failed. Fix reported items before launching.'
    return
  }

  Write-Host 'One-time Windows policy command (if needed):' -ForegroundColor Cyan
  Write-Host '  Set-ExecutionPolicy -Scope CurrentUser RemoteSigned' -ForegroundColor Yellow
  Write-Host 'First-run checks passed.' -ForegroundColor Green
}

function Test-LauncherPrereqs {
  param([System.Collections.IDictionary]$Cfg)

  if (-not (Test-WslDistroExists -Name $Cfg.DistroName)) {
    throw "WSL distro '$($Cfg.DistroName)' not found. Run: wsl -l -v"
  }

  $checkCmd = "'$($Cfg.ScriptsLinuxPath)/doctor.sh' '$($Cfg.RepoLinuxPath)'"
  $rc = Invoke-WslBash -Distro $Cfg.DistroName -Command $checkCmd
  if ($rc -ne 0) {
    throw 'Required WSL paths/scripts are missing. Run -FirstRunChecks for details.'
  }
}

if ($FirstRunChecks) {
  Run-FirstRunChecks -Cfg $Config
  return
}

if ($StopOnly) {
  if (-not (Test-WslDistroExists -Name $Config.DistroName)) {
    throw "WSL distro '$($Config.DistroName)' not found. Run: wsl -l -v"
  }
  $stopCmd = "'$($Config.ScriptsLinuxPath)/start_server.sh' --repo '$($Config.RepoLinuxPath)' --host '$($Config.ListenHost)' --port '$($Config.SpacetimePort)' --stop-only"
  $rc = Invoke-WslBash -Distro $Config.DistroName -Command $stopCmd
  if ($rc -ne 0) {
    Write-Warning 'Stop command returned non-zero. Processes may already be stopped.'
    return
  }
  Write-Host 'Stopped local WSL SpacetimeDB processes (if any).' -ForegroundColor Green
  return
}

Test-LauncherPrereqs -Cfg $Config

if ([string]::IsNullOrWhiteSpace($DatabaseName)) {
  $DatabaseName = 'st-tow-dev-' + (Get-Date -Format 'yyyyMMddHHmmss')
}

$runDir = "/tmp/sttow/$DatabaseName"

$serverLinuxCmd = "'$($Config.ScriptsLinuxPath)/start_server.sh' --repo '$($Config.RepoLinuxPath)' --host '$($Config.ListenHost)' --port '$($Config.SpacetimePort)'"
$publishLinuxCmd = "'$($Config.ScriptsLinuxPath)/publish_and_generate.sh' '$DatabaseName' --repo '$($Config.RepoLinuxPath)' --host '$($Config.ListenHost)' --port '$($Config.SpacetimePort)'"
$webLinuxCmd = "'$($Config.ScriptsLinuxPath)/start_web.sh' '$DatabaseName' --repo '$($Config.RepoLinuxPath)' --host '$($Config.ListenHost)' --spacetime-port '$($Config.SpacetimePort)' --web-port '$($Config.WebPort)'"

$qDistro = Quote-PS $Config.DistroName
$qServerLinuxCmd = Quote-PS $serverLinuxCmd
$qPublishLinuxCmd = Quote-PS $publishLinuxCmd
$qWebLinuxCmd = Quote-PS $webLinuxCmd

$serverCmd = @"
`$Host.UI.RawUI.WindowTitle = 'st-tow: server'
`$Distro = $qDistro
`$Cmd = $qServerLinuxCmd
Write-Host 'Starting WSL SpacetimeDB server...' -ForegroundColor Cyan
Write-Host "cmd: `$Cmd" -ForegroundColor DarkCyan
wsl.exe -d `$Distro -e bash -lc `$Cmd
"@

$publishCmd = @"
`$Host.UI.RawUI.WindowTitle = 'st-tow: publish+generate'
`$Distro = $qDistro
`$Cmd = $qPublishLinuxCmd
Write-Host 'Running publish + bindings generation in WSL...' -ForegroundColor Cyan
Write-Host "cmd: `$Cmd" -ForegroundColor DarkCyan
wsl.exe -d `$Distro -e bash -lc `$Cmd
"@

$webCmd = @"
`$Host.UI.RawUI.WindowTitle = 'st-tow: web'
`$Distro = $qDistro
`$Cmd = $qWebLinuxCmd
Write-Host 'Starting web dev flow in WSL...' -ForegroundColor Cyan
Write-Host "cmd: `$Cmd" -ForegroundColor DarkCyan
wsl.exe -d `$Distro -e bash -lc `$Cmd
"@

Start-PowerShellWindow -CommandText $serverCmd
Start-Sleep -Milliseconds 700
Start-PowerShellWindow -CommandText $publishCmd
Start-Sleep -Milliseconds 700
Start-PowerShellWindow -CommandText $webCmd

Write-Host "Launcher: $ScriptVersion" -ForegroundColor Cyan
Write-Host "Script path: $PSCommandPath" -ForegroundColor DarkCyan
Write-Host "WSL distro: $($Config.DistroName)" -ForegroundColor DarkCyan
Write-Host "Repo path: $($Config.RepoLinuxPath)" -ForegroundColor DarkCyan
Write-Host "DB name: $DatabaseName" -ForegroundColor DarkCyan
Write-Host "Run dir: $runDir" -ForegroundColor DarkCyan
Write-Host 'Launched 3 terminals: server, publish+generate, web.' -ForegroundColor Green
Write-Host "Publish log: $runDir/publish.log" -ForegroundColor Yellow
Write-Host "Generate log: $runDir/generate.log" -ForegroundColor Yellow
Write-Host "Web log: $runDir/web.log" -ForegroundColor Yellow
