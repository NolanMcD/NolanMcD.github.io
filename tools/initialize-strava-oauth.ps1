$ErrorActionPreference = "Stop"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI is required for this one-time setup. Install it from https://cli.github.com/ and rerun this script."
}

function ConvertFrom-SecureValue {
    param([Security.SecureString]$Value)

    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

$repository = "NolanMcD/NolanMcD.github.io"
$clientId = Read-Host "Strava client ID"
$clientSecret = ConvertFrom-SecureValue (Read-Host "Strava client secret" -AsSecureString)
$authorizationCode = Read-Host "One-time Strava authorization code"
$rotatorToken = ConvertFrom-SecureValue (Read-Host "Fine-grained GitHub rotation token" -AsSecureString)

try {
    $tokenResponse = Invoke-RestMethod -Method Post -Uri "https://www.strava.com/oauth/token" -Body @{
        client_id = $clientId
        client_secret = $clientSecret
        code = $authorizationCode
        grant_type = "authorization_code"
    }

    if (-not $tokenResponse.refresh_token) {
        throw "Strava did not return a refresh token. Generate a new authorization code and retry."
    }

    $previousGhToken = $env:GH_TOKEN
    $env:GH_TOKEN = $rotatorToken
    try {
        $secrets = [ordered]@{
            STRAVA_CLIENT_ID = $clientId
            STRAVA_CLIENT_SECRET = $clientSecret
            STRAVA_REFRESH_TOKEN = [string]$tokenResponse.refresh_token
            STRAVA_SECRET_ROTATOR_TOKEN = $rotatorToken
        }
        foreach ($entry in $secrets.GetEnumerator()) {
            $entry.Value | & gh secret set $entry.Key --repo $repository
            if ($LASTEXITCODE -ne 0) { throw "Could not set GitHub secret $($entry.Key)." }
        }
    }
    finally {
        $env:GH_TOKEN = $previousGhToken
    }

    Write-Host "Strava OAuth secrets are configured. Run the 'Sync public Strava activities' workflow in GitHub Actions."
}
finally {
    $clientSecret = $null
    $rotatorToken = $null
    $authorizationCode = $null
    $tokenResponse = $null
}
