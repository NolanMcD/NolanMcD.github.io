param(
    [string]$CsvPath = "reviews.csv",
    [string]$OutputPath = "assets/data/film-diary.json",
    [string]$LatestOutputPath = "assets/data/latest-letterboxd.json",
    [string]$FeedUrl = "https://letterboxd.com/nolanmcd/rss/",
    [switch]$SkipFeed
)

$ErrorActionPreference = "Stop"

function Resolve-RepositoryPath([string]$Path) {
    if ([IO.Path]::IsPathRooted($Path)) { return $Path }
    return Join-Path (Split-Path -Parent $PSScriptRoot) $Path
}

function Get-NodeText($Node, [string]$LocalName) {
    $match = $Node.SelectSingleNode("*[local-name()='$LocalName']")
    if ($null -eq $match) { return "" }
    return [string]$match.InnerText
}

function ConvertFrom-ReviewHtml([string]$Html) {
    if ([string]::IsNullOrWhiteSpace($Html)) { return "" }
    $paragraphs = [regex]::Matches($Html, '<p[^>]*>(.*?)</p>', 'Singleline') |
        ForEach-Object { $_.Groups[1].Value } |
        Where-Object { $_ -notmatch '<img\b' }
    $text = ($paragraphs -join "`n`n")
    $text = [regex]::Replace($text, '<br\s*/?>', "`n", 'IgnoreCase')
    $text = [regex]::Replace($text, '<[^>]+>', '')
    return [Net.WebUtility]::HtmlDecode($text).Trim()
}

function Get-WordCount([string]$Text) {
    if ([string]::IsNullOrWhiteSpace($Text)) { return 0 }
    return @(($Text -split '\s+') | Where-Object { $_ }).Count
}

function Set-EntryValue($Entry, [string]$Name, $Value) {
    if ($Entry -is [Collections.IDictionary]) {
        $Entry[$Name] = $Value
    } else {
        $Entry | Add-Member -NotePropertyName $Name -NotePropertyValue $Value -Force
    }
}

$tagLabels = @{
    "hbomax" = "HBO Max"; "appletv" = "Apple TV"; "plutotv" = "Pluto TV"
    "disney+" = "Disney+"; "dialouge" = "Dialogue"; "ureserves" = "University reserves"
    "mubi" = "MUBI"; "tv" = "TV"; "sci-fi" = "Sci-fi"; "rom-com" = "Rom-com"
}

$sourceLabels = @{
    "in theatres" = "In theatres"; "argh matey" = "Other"; "hbomax" = "HBO Max"
    "tv on demand" = "TV on demand"; "netflix" = "Netflix"; "criterion" = "Criterion"
    "prime video" = "Prime Video"; "on a plane" = "On a plane"; "my collection" = "My collection"
    "youtube" = "YouTube"; "mubi" = "MUBI"; "tubi" = "Tubi"; "peacock" = "Peacock"
    "cosford" = "Cosford Cinema"; "ureserves" = "University reserves"; "appletv" = "Apple TV"
    "plutotv" = "Pluto TV"; "tv" = "TV"; "hulu" = "Hulu"; "disney+" = "Disney+"
    "read the screenplay" = "Read the screenplay"; "rented" = "Rented"
}

function Format-Tag([string]$Tag) {
    $key = $Tag.Trim().ToLowerInvariant()
    if ($tagLabels.ContainsKey($key)) { return $tagLabels[$key] }
    if ($sourceLabels.ContainsKey($key)) { return $sourceLabels[$key] }
    return [Globalization.CultureInfo]::GetCultureInfo("en-US").TextInfo.ToTitleCase($key)
}

function New-NormalizedEntry {
    param(
        [string]$Id, [string]$Title, [int]$Year, [int]$Rating,
        [string]$Review, [string]$PublishedDate, [string]$WatchedDate,
        [bool]$Rewatch, [string]$Url, [array]$Tags, [string]$Origin,
        [string]$TmdbId = "", [string]$SyncId = ""
    )
    $cleanTags = @($Tags | ForEach-Object { ([string]$_).Trim().ToLowerInvariant() } | Where-Object { $_ })
    $sources = @($cleanTags | Where-Object { $sourceLabels.ContainsKey($_) } | ForEach-Object { $sourceLabels[$_] } | Select-Object -Unique)
    $awardTags = @($cleanTags | Where-Object { -not $sourceLabels.ContainsKey($_) } | ForEach-Object { Format-Tag $_ } | Select-Object -Unique)
    [ordered]@{
        id = $Id
        syncId = $SyncId
        title = $Title
        year = $Year
        rating = $Rating
        review = $Review.Trim()
        wordCount = Get-WordCount $Review
        publishedDate = $PublishedDate
        watchedDate = if ($WatchedDate) { $WatchedDate } else { $PublishedDate }
        rewatch = $Rewatch
        url = $Url
        tmdbId = $TmdbId
        tags = @($cleanTags | ForEach-Object { Format-Tag $_ })
        viewingSources = $sources
        awardTags = $awardTags
        awardTagsReliable = ($awardTags.Count -eq $Rating)
        origin = $Origin
    }
}

$resolvedCsv = Resolve-RepositoryPath $CsvPath
$resolvedOutput = Resolve-RepositoryPath $OutputPath
$resolvedLatestOutput = Resolve-RepositoryPath $LatestOutputPath
$entries = [Collections.Generic.List[object]]::new()
$hasCsv = Test-Path -LiteralPath $resolvedCsv

if ($hasCsv) {
    foreach ($row in @(Import-Csv -LiteralPath $resolvedCsv)) {
        $tags = if ($row.Tags) { @($row.Tags -split ',') } else { @() }
        $entries.Add((New-NormalizedEntry `
            -Id ("csv:" + $row.'Letterboxd URI') -Title $row.Name -Year ([int]$row.Year) `
            -Rating ([int]$row.Rating) -Review $row.Review -PublishedDate $row.Date `
            -WatchedDate $row.'Watched Date' -Rewatch ($row.Rewatch -eq 'Yes') `
            -Url $row.'Letterboxd URI' -Tags $tags -Origin "csv"))
    }
} elseif (Test-Path -LiteralPath $resolvedOutput) {
    $previous = Get-Content -Raw -LiteralPath $resolvedOutput | ConvertFrom-Json
    foreach ($entry in $previous) { $entries.Add($entry) }
}

if ($hasCsv -and (Test-Path -LiteralPath $resolvedOutput)) {
    $previous = Get-Content -Raw -LiteralPath $resolvedOutput | ConvertFrom-Json
    foreach ($entry in @($previous | Where-Object { $_.origin -eq 'rss' })) {
        $alreadyInCsv = $entries | Where-Object {
            $_.title -eq $entry.title -and $_.year -eq $entry.year -and $_.watchedDate -eq $entry.watchedDate
        } | Select-Object -First 1
        if (-not $alreadyInCsv) { $entries.Add($entry) }
    }
}

if (-not $SkipFeed) {
    [xml]$feed = (Invoke-WebRequest -Uri $FeedUrl -UseBasicParsing).Content
    foreach ($item in @($feed.rss.channel.item)) {
        $filmTitle = Get-NodeText $item "filmTitle"
        $ratingText = Get-NodeText $item "memberRating"
        if (-not $filmTitle -or -not $ratingText) { continue }

        $year = [int](Get-NodeText $item "filmYear")
        $watchedDate = Get-NodeText $item "watchedDate"
        $guid = Get-NodeText $item "guid"
        $review = ConvertFrom-ReviewHtml (Get-NodeText $item "description")
        if (-not $review) { continue }
        $publishedDate = ([DateTimeOffset]::Parse((Get-NodeText $item "pubDate"))).ToString("yyyy-MM-dd")
        $match = $entries | Where-Object {
            ($_.syncId -and $_.syncId -eq $guid) -or
            ($_.title -eq $filmTitle -and $_.year -eq $year -and $_.watchedDate -eq $watchedDate)
        } | Select-Object -First 1

        if ($match) {
            Set-EntryValue $match "syncId" $guid
            Set-EntryValue $match "rating" ([int][double]$ratingText)
            Set-EntryValue $match "review" $review
            Set-EntryValue $match "wordCount" (Get-WordCount $review)
            Set-EntryValue $match "publishedDate" $publishedDate
            Set-EntryValue $match "rewatch" ((Get-NodeText $item "rewatch") -eq "Yes")
            Set-EntryValue $match "url" (Get-NodeText $item "link")
            Set-EntryValue $match "tmdbId" (Get-NodeText $item "movieId")
        } else {
            $entries.Add((New-NormalizedEntry `
                -Id ("rss:" + $guid) -SyncId $guid -Title $filmTitle -Year $year `
                -Rating ([int][double]$ratingText) -Review $review -PublishedDate $publishedDate `
                -WatchedDate $watchedDate -Rewatch ((Get-NodeText $item "rewatch") -eq "Yes") `
                -Url (Get-NodeText $item "link") -Tags @() -Origin "rss" -TmdbId (Get-NodeText $item "movieId")))
        }
    }
}

$sortedEntries = @($entries | Sort-Object @{ Expression = { $_.publishedDate }; Descending = $true }, @{ Expression = { $_.title }; Descending = $false })
$sorted = @($sortedEntries | ForEach-Object {
    [ordered]@{
        id = $_.id; syncId = $_.syncId; title = $_.title; year = [int]$_.year
        rating = [int]$_.rating; review = $_.review; wordCount = [int]$_.wordCount
        publishedDate = $_.publishedDate; watchedDate = $_.watchedDate; rewatch = [bool]$_.rewatch
        url = $_.url; tmdbId = $_.tmdbId; tags = @($_.tags); viewingSources = @($_.viewingSources)
        awardTags = @($_.awardTags); awardTagsReliable = [bool]$_.awardTagsReliable; origin = $_.origin
    }
})
$outputDirectory = Split-Path -Parent $resolvedOutput
if (-not (Test-Path -LiteralPath $outputDirectory)) { New-Item -ItemType Directory -Path $outputDirectory | Out-Null }
$json = ConvertTo-Json -InputObject $sorted -Depth 6
[IO.File]::WriteAllText($resolvedOutput, $json + "`n", [Text.UTF8Encoding]::new($false))
$latestJson = ConvertTo-Json -InputObject @($sorted | Select-Object -First 6) -Depth 6
[IO.File]::WriteAllText($resolvedLatestOutput, $latestJson + "`n", [Text.UTF8Encoding]::new($false))

Write-Host "Wrote $($sorted.Count) Film Diary entries and the latest-review feed."
