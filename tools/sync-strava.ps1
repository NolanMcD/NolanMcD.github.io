param(
    [string]$OutputPath = "assets/data/strava-feed.json",
    [ValidateRange(1, 30)]
    [int]$MaxActivities = 6,
    [string]$InputFixture
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$resolvedOutput = if ([IO.Path]::IsPathRooted($OutputPath)) { $OutputPath } else { Join-Path $repoRoot $OutputPath }

function Get-RequiredEnvironmentVariable {
    param([string]$Name)

    $value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Required environment variable '$Name' is missing."
    }
    return $value
}

function ConvertTo-ActivityLabel {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) { return "Activity" }
    return (($Value -creplace '([a-z0-9])([A-Z])', '$1 $2') -replace '_', ' ')
}

function ConvertTo-DurationLabel {
    param([int]$Seconds)

    $hours = [math]::Floor($Seconds / 3600)
    $minutes = [math]::Floor(($Seconds % 3600) / 60)
    if ($hours -gt 0) { return "$hours hr $minutes min" }
    if ($minutes -gt 0) { return "$minutes min" }
    return "$Seconds sec"
}

if ($InputFixture) {
    $fixturePath = if ([IO.Path]::IsPathRooted($InputFixture)) { $InputFixture } else { Join-Path $repoRoot $InputFixture }
    $activities = Get-Content -LiteralPath $fixturePath -Raw | ConvertFrom-Json
}
else {
    $clientId = Get-RequiredEnvironmentVariable "STRAVA_CLIENT_ID"
    $clientSecret = Get-RequiredEnvironmentVariable "STRAVA_CLIENT_SECRET"
    $refreshToken = Get-RequiredEnvironmentVariable "STRAVA_REFRESH_TOKEN"
    $null = Get-RequiredEnvironmentVariable "STRAVA_SECRET_ROTATOR_TOKEN"
    $repository = Get-RequiredEnvironmentVariable "GITHUB_REPOSITORY"

    $tokenResponse = Invoke-RestMethod -Method Post -Uri "https://www.strava.com/oauth/token" -Body @{
        client_id = $clientId
        client_secret = $clientSecret
        refresh_token = $refreshToken
        grant_type = "refresh_token"
    }

    if (-not $tokenResponse.access_token -or -not $tokenResponse.refresh_token) {
        throw "Strava returned an incomplete token response."
    }

    Write-Output "::add-mask::$($tokenResponse.access_token)"
    Write-Output "::add-mask::$($tokenResponse.refresh_token)"

    # Strava can replace the refresh token on every refresh. Persist it before
    # making any other request so a later failure cannot strand the workflow.
    $tokenResponse.refresh_token | & gh secret set STRAVA_REFRESH_TOKEN --repo $repository
    if ($LASTEXITCODE -ne 0) {
        throw "The rotated Strava refresh token could not be saved. Reauthorize Strava before retrying."
    }

    $headers = @{ Authorization = "Bearer $($tokenResponse.access_token)" }
    $activities = Invoke-RestMethod -Method Get -Uri "https://www.strava.com/api/v3/athlete/activities?per_page=30&page=1" -Headers $headers
}

$publicActivities = @($activities | Where-Object { $_.visibility -eq "everyone" } | Select-Object -First $MaxActivities)
if ($publicActivities.Count -eq 0) {
    throw "No public Strava activities were returned; the existing feed was left unchanged."
}

$feed = @(foreach ($activity in $publicActivities) {
    $type = ConvertTo-ActivityLabel $(if ($activity.sport_type) { $activity.sport_type } else { $activity.type })
    $stats = @()
    if ([double]$activity.distance -gt 0) {
        $stats += (([double]$activity.distance / 1609.344).ToString("0.0", [Globalization.CultureInfo]::InvariantCulture) + " mi")
    }
    if ([int]$activity.moving_time -gt 0) {
        $stats += ConvertTo-DurationLabel ([int]$activity.moving_time)
    }
    if ([double]$activity.total_elevation_gain -gt 0) {
        $stats += ([math]::Round([double]$activity.total_elevation_gain * 3.28084).ToString() + " ft climbed")
    }

    $summary = if (-not [string]::IsNullOrWhiteSpace([string]$activity.description)) {
        ([string]$activity.description).Trim()
    } else {
        "A recent $($type.ToLowerInvariant()) activity from Strava."
    }

    [ordered]@{
        id = [string]$activity.id
        title = [string]$activity.name
        type = $type
        date = ([string]$activity.start_date_local).Substring(0, 10)
        summary = $summary
        stats = $stats
        url = "https://www.strava.com/activities/$($activity.id)"
    }
})

$json = ConvertTo-Json -InputObject $feed -Depth 5
$outputDirectory = Split-Path -Parent $resolvedOutput
if (-not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}
[IO.File]::WriteAllText($resolvedOutput, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
Write-Host "Wrote $($feed.Count) public Strava activities to $OutputPath."
