# Strava feed OAuth setup

The site syncs only activities whose Strava visibility is **Everyone**. The workflow refreshes its short-lived access token on each run and immediately replaces the stored refresh token if Strava rotates it. No credential is written to the repository or feed JSON.

## 1. Create the Strava application

1. Open [Strava API settings](https://www.strava.com/settings/api) and create an application.
2. Set its authorization callback domain to `localhost`.
3. Keep the client ID and client secret private.

## 2. Authorize read access once

Replace `CLIENT_ID` in this URL, open it while signed into Strava, and approve access:

```text
https://www.strava.com/oauth/authorize?client_id=CLIENT_ID&response_type=code&redirect_uri=http%3A%2F%2Flocalhost&approval_prompt=force&scope=activity%3Aread
```

The localhost page may fail to load. That is expected. Copy only the `code` value from the browser's redirected address; do not paste it into chat, an issue, or a committed file.

The repository includes an interactive helper that exchanges this code and stores the resulting credentials without printing them or putting them in shell history. Install [GitHub CLI](https://cli.github.com/) and run:

```powershell
.\tools\initialize-strava-oauth.ps1
```

Wait to run it until the fine-grained token in step 3 is ready. The authorization code is short-lived, so generate a new one if Strava rejects it.

## 3. Create the narrowly scoped rotation token

Create a fine-grained GitHub personal access token with:

- Resource owner: `NolanMcD`
- Repository access: only `NolanMcD.github.io`
- Repository permission: **Secrets — Read and write**
- A reasonable expiration date and no unrelated permissions

This token cannot be replaced by the workflow's ordinary `GITHUB_TOKEN`: GitHub intentionally prevents that token from managing repository Actions secrets.

## 4. Add four Actions secrets

The interactive helper adds these four repository Actions secrets:

- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REFRESH_TOKEN`
- `STRAVA_SECRET_ROTATOR_TOKEN` (the fine-grained GitHub token from step 3)

Alternatively, add them manually in the repository's **Settings → Secrets and variables → Actions**. Never store these values as variables, source files, workflow literals, or feed data.

## 5. Start and verify the feed

Open **Actions → Sync public Strava activities → Run workflow**. A successful run updates `assets/data/strava-feed.json`; the homepage reads that file automatically. Until all four secrets exist, scheduled runs exit successfully without changing anything.

If token rotation fails after Strava has issued a new token, authorize the application again and replace `STRAVA_REFRESH_TOKEN`. If the fine-grained GitHub token expires, replace only `STRAVA_SECRET_ROTATOR_TOKEN`.

For a credential-free local test:

```powershell
.\tools\sync-strava.ps1 -InputFixture tools\fixtures\strava-activities.json -OutputPath "$env:TEMP\strava-feed-test.json"
```
