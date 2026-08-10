param()

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$failures = [Collections.Generic.List[string]]::new()

function Add-Failure([string]$Message) {
    $failures.Add($Message)
    Write-Host "ERROR: $Message" -ForegroundColor Red
}

function Get-RelativePath([string]$Path) {
    $resolvedRoot = (Resolve-Path -LiteralPath $root).Path.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    $resolvedPath = (Resolve-Path -LiteralPath $Path).Path
    if (-not $resolvedPath.StartsWith($resolvedRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Path is outside the repository: $resolvedPath"
    }
    return $resolvedPath.Substring($resolvedRoot.Length).TrimStart('\', '/').Replace('\', '/')
}

Write-Host "Checking JSON..."
$jsonFiles = @(
    Get-ChildItem (Join-Path $root "assets/data") -Filter *.json -File
    Get-ChildItem (Join-Path $root "assets/audio") -Filter *.json -File
    Get-ChildItem (Join-Path $root "_data") -Filter *.json -File
    Get-ChildItem (Join-Path $root "tools/fixtures") -Filter *.json -File
)
foreach ($file in $jsonFiles) {
    try {
        Get-Content -Raw -LiteralPath $file.FullName | ConvertFrom-Json | Out-Null
    } catch {
        Add-Failure "Invalid JSON in $(Get-RelativePath $file.FullName): $($_.Exception.Message)"
    }
}

Write-Host "Checking posts and front matter..."
$contentFiles = @(
    Get-ChildItem (Join-Path $root "_posts") -Filter *.md -File
    Get-ChildItem (Join-Path $root "_drafts") -Filter *.md -File
    Get-ChildItem $root -Filter *.md -File | Where-Object Name -ne "README.md"
)
foreach ($file in $contentFiles) {
    $relative = Get-RelativePath $file.FullName
    $content = Get-Content -Raw -LiteralPath $file.FullName
    if ($content -notmatch '(?s)^---\r?\n.+?\r?\n---(?:\r?\n|$)') {
        Add-Failure "Missing or malformed front matter in $relative"
    }
    if ($file.Directory.Name -eq "_posts" -and $file.Name -notmatch '^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*\.md$') {
        Add-Failure "Invalid post filename: $relative"
    }
}

Write-Host "Checking local asset references..."
$referenceFiles = Get-ChildItem $root -Recurse -File -Include *.md,*.html,*.scss,*.js |
    Where-Object FullName -notmatch '[\\/]\.git[\\/]'
foreach ($file in $referenceFiles) {
    $content = Get-Content -Raw -LiteralPath $file.FullName
    foreach ($match in [regex]::Matches($content, '(?<![A-Za-z0-9.:])/assets/[A-Za-z0-9_.\-/]+')) {
        $assetPath = $match.Value.TrimEnd('.', ',', ';', ':')
        if ($assetPath.EndsWith('/')) { continue }
        $diskPath = Join-Path $root $assetPath.TrimStart('/')
        if ($assetPath -eq '/assets/main.css') {
            $diskPath = Join-Path $root 'assets/main.scss'
        }
        if (-not (Test-Path -LiteralPath $diskPath -PathType Leaf)) {
            Add-Failure "Missing asset $assetPath referenced by $(Get-RelativePath $file.FullName)"
        }
    }
}

Write-Host "Checking storm catalog..."
$audioRoot = Join-Path $root "assets/audio"
$catalogPath = Join-Path $audioRoot "storms.json"
if (Test-Path -LiteralPath $catalogPath) {
    $catalog = @(Get-Content -Raw -LiteralPath $catalogPath | ConvertFrom-Json)
    $catalogFiles = @($catalog | ForEach-Object { $_.file } | Where-Object { $_ -and $_ -notmatch '^https?://' })
    foreach ($name in $catalogFiles) {
        if (-not (Test-Path -LiteralPath (Join-Path $audioRoot $name) -PathType Leaf)) {
            Add-Failure "Storm catalog references missing file: assets/audio/$name"
        }
    }
    $uncataloged = Get-ChildItem $audioRoot -Filter *.m4a -File |
        Where-Object Name -notin $catalogFiles
    foreach ($file in $uncataloged) {
        Add-Failure "Audio file is missing from storms.json: assets/audio/$($file.Name)"
    }
}

Write-Host "Checking file sizes..."
Get-ChildItem $root -Recurse -File |
    Where-Object { $_.FullName -notmatch '[\\/]\.git[\\/]' -and $_.Length -ge 100MB } |
    ForEach-Object { Add-Failure "File exceeds GitHub's 100 MiB limit: $(Get-RelativePath $_.FullName)" }

if ($failures.Count -gt 0) {
    throw "Repository checks failed with $($failures.Count) error(s)."
}

Write-Host "Repository checks passed ($($jsonFiles.Count) JSON files, $($contentFiles.Count) content files)." -ForegroundColor Green
