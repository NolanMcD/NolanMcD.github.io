param(
    [string]$CsvPath = "ratings.csv",
    [string]$OutputPath = "assets/data/rating-distribution.json"
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not [IO.Path]::IsPathRooted($CsvPath)) { $CsvPath = Join-Path $root $CsvPath }
if (-not [IO.Path]::IsPathRooted($OutputPath)) { $OutputPath = Join-Path $root $OutputPath }
# Letterboxd ratings.csv contains one current rating per film, including films
# that have never been reviewed or logged in the diary.
$films = [Collections.Generic.Dictionary[string, int]]::new([StringComparer]::Ordinal)
foreach ($row in @(Import-Csv -LiteralPath $CsvPath)) {
    $identity = $row.'Letterboxd URI'
    if (-not $identity) { throw 'The ratings export is missing a Letterboxd URI.' }
    $rating = 0.0
    if (-not [double]::TryParse($row.Rating, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$rating) -or $rating -lt 1 -or $rating -gt 5 -or $rating -ne [math]::Floor($rating)) {
        throw 'This chart uses your whole-star scale. The export contains a missing, invalid, or half-star rating.'
    }
    $films[$identity] = [int]$rating
}
if (-not $films.Count) { throw 'No ratings found in the export.' }
$rows = @(1..5 | ForEach-Object {
    $rating = $_
    [ordered]@{ rating = $rating; count = @($films.Values | Where-Object { $_ -eq $rating }).Count }
})
$weighted = 0
foreach ($row in $rows) { $weighted += $row.rating * $row.count }
$mode = ($rows | Sort-Object @{Expression = {[int]$_.count}; Descending = $true}, @{Expression = {[int]$_.rating}; Descending = $false} | Select-Object -First 1).rating
$result = [ordered]@{
    total = $films.Count
    average = [math]::Round($weighted / $films.Count, 2)
    mostCommon = $mode
    source = 'letterboxd-ratings-export'
    ratings = $rows
}
$json = ConvertTo-Json -InputObject $result -Depth 4
[IO.File]::WriteAllText($OutputPath, $json + "`n", [Text.UTF8Encoding]::new($false))
Write-Host "Wrote $($films.Count) current film ratings from the Letterboxd export."
