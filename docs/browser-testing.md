# Browser testing

The browser suite runs five visitor journeys in desktop Chromium and an emulated iPhone 13 viewport using Chromium. It serves the already-built `_site` from `127.0.0.1:4173`. It never uses the production site as its test target. Build output is excluded from Git.

## Local setup

Install Node 24, Python 3, Ruby and Bundler, and pnpm 11.25.0. Then:

```text
bundle install
bundle exec jekyll build --strict_front_matter
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm test:browser
```

Playwright starts and stops `tools/serve-browser-site.py`. Keep port 4173 free. It deliberately refuses to reuse an unrelated existing server. To inspect a report, run `pnpm test:browser:report`. Screenshots and traces for failing tests are under `test-results/`.

On Windows, to use an installed Chrome instead of downloading Chromium:

```powershell
$env:PW_CHANNEL = 'chrome'
pnpm test:browser
```

The initial local smoke run used generated pages retrieved from the preceding successful deployment because Ruby was unavailable in the Windows shell. GitHub Actions performs the authoritative source build and runs the suite against that complete output. Do not use that smoke-test shortcut as a replacement for CI.

## Coverage and evidence

`tests/browser/site.spec.cjs` covers combined archive filtering/history, director sort/ties/shared links/image fallback, the embedded Shannon purchase and its parent ending, Miami camera synchronization/completion/replay, and dark-mode persistence. It also checks document width, including the embedded airport document, after representative interactions. External requests are aborted to keep tests independent of third-party image hosts. Local assets are available in the full CI build; the suite does not certify image availability or visual fidelity.

Retries are disabled. HTML reports, screenshots, and traces are uploaded by CI with a fourteen-day retention. Normal passing runs retain the report; screenshots and traces are retained on failures only. Desktop and phone are Chromium profiles, not cross-browser or physical-device coverage. There are no screenshot-baseline assertions or comprehensive accessibility audits.

## Optional deliberate failure

The negative control in `tests/browser/overflow-probe.spec.cjs` injects a wide component in the browser only and should fail. It is excluded from the normal suite. To reproduce on PowerShell:

```powershell
$env:PW_OVERFLOW_PROBE = '1'
pnpm exec playwright test --project=phone-chromium
Remove-Item Env:PW_OVERFLOW_PROBE
```

On POSIX shells: `PW_OVERFLOW_PROBE=1 pnpm exec playwright test --project=phone-chromium`.

Expect a nonzero exit and failure screenshot/trace. The original result measured a 390px viewport and 915px document. Do not enable this variable in the production workflow. Remove it before running the normal suite again. The published screenshot is explicitly labeled as an injected fault, not an actual production bug.

## Deployment

`.github/workflows/check-site.yml` runs existing checks, builds Jekyll, validates the built pages, runs Playwright, and uploads `_site` for deployment only on main-branch pushes, manual main-branch runs, or successful completion of the four named main-branch content-sync workflows. The workflow-run path checks out the latest source from this repository's default branch; it does not consume predecessor artifacts or untrusted branch code. This completion trigger is necessary because bot pushes made with `GITHUB_TOKEN` do not themselves trigger another push workflow. It may rerun checks after an unchanged successful sync.

The deploy job has `needs: validate`, restricted Pages/OIDC permissions, and the `github-pages` environment. Pull requests do not publish. The weather workflow no longer requests a legacy Pages build. Pages must use `build_type: workflow`, preserving the existing `noland.blog` custom domain and HTTPS settings. The older independent legacy Pages build must not remain the publishing source.

Useful references: [Playwright CI](https://playwright.dev/docs/ci), [failure diagnostics](https://playwright.dev/docs/test-use-options), and [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
