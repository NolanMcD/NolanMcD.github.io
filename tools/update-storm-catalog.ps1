$ErrorActionPreference = "Stop"

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$audioDirectory = Join-Path $repositoryRoot "assets\audio"
$catalogPath = Join-Path $audioDirectory "storms.json"
$supportedExtensions = @(".m4a", ".mp3", ".aac", ".wav", ".ogg")
$shell = New-Object -ComObject Shell.Application
$shellFolder = $shell.Namespace($audioDirectory)

$catalog = Get-ChildItem -LiteralPath $audioDirectory -File |
    Where-Object { $supportedExtensions -contains $_.Extension.ToLowerInvariant() } |
    Sort-Object Name |
    ForEach-Object {
        $durationText = $shellFolder.GetDetailsOf($shellFolder.ParseName($_.Name), 27)
        $durationParts = $durationText.Split(":")
        $durationSeconds = if ($durationParts.Count -eq 3) {
            ([int]$durationParts[0] * 3600) + ([int]$durationParts[1] * 60) + [int]$durationParts[2]
        } else { 0 }
        [ordered]@{ file = $_.Name; duration = $durationSeconds }
    }

$json = ConvertTo-Json -InputObject @($catalog) -Depth 3
Set-Content -LiteralPath $catalogPath -Value $json -Encoding utf8

Write-Host "Added $(@($catalog).Count) recordings to assets/audio/storms.json."
