param(
    [string]$CsvPath = "local-data/reviews.csv",
    [string]$OutputPath = "assets/data/film-diary.json",
    [string]$LatestOutputPath = "assets/data/latest-letterboxd.json",
    [string]$DistributionOutputPath = "assets/data/rating-distribution.json",
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

# Repair UTF-8 text that an upstream client previously decoded as Windows-1252.
# Running the conversion repeatedly also recovers text that was corrupted over
# several syncs. The strict decoder stops as soon as the text can no longer be
# a valid UTF-8 byte sequence, which protects ordinary accented text.
function Repair-Mojibake([string]$Text) {
    if ([string]::IsNullOrEmpty($Text)) { return $Text }

    $windows1252 = [Text.Encoding]::GetEncoding(1252)
    $strictUtf8 = [Text.UTF8Encoding]::new($false, $true)
    $markers = '[\u00C3\u00C2\u00E2\u00C6\u00F0\u20AC\u2122\u0153\u017E\u0161\u0192\u2020\u2021\u2030\uFFFD]'
    $current = $Text

    for ($attempt = 0; $attempt -lt 8; $attempt++) {
        if (-not [regex]::IsMatch($current, $markers)) { break }
        try {
            $candidate = $strictUtf8.GetString($windows1252.GetBytes($current))
        } catch {
            break
        }
        if ($candidate -eq $current) { break }
        $current = $candidate
    }

    return $current
}

function ConvertFrom-ReviewHtml([string]$Html) {
    if ([string]::IsNullOrWhiteSpace($Html)) { return "" }
    $paragraphs = [regex]::Matches($Html, '<p[^>]*>(.*?)</p>', 'Singleline') |
        ForEach-Object { $_.Groups[1].Value } |
        Where-Object { $_ -notmatch '<img\b' }
    $text = ($paragraphs -join "`n`n")
    $text = [regex]::Replace($text, '<br\s*/?>', "`n", 'IgnoreCase')
    $text = [regex]::Replace($text, '<[^>]+>', '')
    return Repair-Mojibake ([Net.WebUtility]::HtmlDecode($text).Trim())
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
    $Title = Repair-Mojibake $Title
    $Review = Repair-Mojibake $Review
    $cleanTags = @($Tags | ForEach-Object { (Repair-Mojibake ([string]$_)).Trim().ToLowerInvariant() } | Where-Object { $_ })
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
$resolvedDistributionOutput = Resolve-RepositoryPath $DistributionOutputPath
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
    $cleanTitle = Repair-Mojibake ([string]$_.title)
    $cleanReview = Repair-Mojibake ([string]$_.review)
    $cleanTags = @($_.tags | ForEach-Object { Repair-Mojibake ([string]$_) })
    $cleanSources = @($_.viewingSources | ForEach-Object { Repair-Mojibake ([string]$_) })
    $cleanAwardTags = @($_.awardTags | ForEach-Object { Repair-Mojibake ([string]$_) })
    [ordered]@{
        id = $_.id; syncId = $_.syncId; title = $cleanTitle; year = [int]$_.year
        rating = [int]$_.rating; review = $cleanReview; wordCount = Get-WordCount $cleanReview
        publishedDate = $_.publishedDate; watchedDate = $_.watchedDate; rewatch = [bool]$_.rewatch
        url = $_.url; tmdbId = $_.tmdbId; tags = $cleanTags; viewingSources = $cleanSources
        awardTags = $cleanAwardTags; awardTagsReliable = [bool]$_.awardTagsReliable; origin = $_.origin
    }
})
$outputDirectory = Split-Path -Parent $resolvedOutput
if (-not (Test-Path -LiteralPath $outputDirectory)) { New-Item -ItemType Directory -Path $outputDirectory | Out-Null }
$json = ConvertTo-Json -InputObject $sorted -Depth 6
[IO.File]::WriteAllText($resolvedOutput, $json + "`n", [Text.UTF8Encoding]::new($false))
$latestJson = ConvertTo-Json -InputObject @($sorted | Select-Object -First 6) -Depth 6
[IO.File]::WriteAllText($resolvedLatestOutput, $latestJson + "`n", [Text.UTF8Encoding]::new($false))

$ratingRows = @()
$ratingTotal = 0
$ratingWeightedTotal = 0
for ($rating = 5; $rating -ge 1; $rating--) {
    $count = @($sorted | Where-Object { [int]$_.rating -eq $rating }).Count
    $ratingTotal += $count
    $ratingWeightedTotal += $rating * $count
    $ratingRows += [ordered]@{ rating = $rating; count = $count }
}
$mostCommonRating = ($ratingRows | Sort-Object count -Descending | Select-Object -First 1).rating
$distribution = [ordered]@{
    total = $ratingTotal
    average = if ($ratingTotal) { [math]::Round($ratingWeightedTotal / $ratingTotal, 2) } else { 0 }
    mostCommon = $mostCommonRating
    ratings = $ratingRows
}
$distributionJson = ConvertTo-Json -InputObject $distribution -Depth 4
[IO.File]::WriteAllText($resolvedDistributionOutput, $distributionJson + "`n", [Text.UTF8Encoding]::new($false))

Write-Host "Wrote $($sorted.Count) Film Diary entries, the latest-review feed, and the rating distribution."
