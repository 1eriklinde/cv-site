# Build and deploy a CV site, free, from anywhere

A recipe for an AI coding agent. It produces a single-page static site on
Cloudflare Workers, a public GitHub repository, and a pipeline that runs tests
and deploys on every push. Cost: nothing. It works from a terminal, a browser,
or a phone, because no step needs a local machine or a localhost callback.

Written from a session that did exactly this in 24 minutes. The gotchas near
the bottom are the ones that actually cost time — read them before starting,
not after.

## What the person needs

Three free accounts and a browser: GitHub, Cloudflare, and Claude. No payment
card, no domain, no server.

## 1. Ask before building

Get these answered before writing code. They change the output more than any
technical decision:

- Whose CV is it, and what roles are they targeting? Content that reads as
  "digital signage technician" versus "IT operations engineer" is the same
  history framed twice.
- What should the design be? A CV site is a design artefact. Pick a direction
  deliberately rather than defaulting to a centred card with a serif heading.
- What contact details should be public? Email and links, usually. A phone
  number on a crawlable page is a spam magnet, and if the CV PDF carries one,
  serving that PDF publicly leaks it anyway.

## 2. Build the site

Plain HTML, CSS and JavaScript in a `public/` directory. No framework and no
build step: there is nothing to compile, nothing to keep patched, and the whole
thing deploys as files.

```
public/
  index.html      content as semantic HTML, readable with JS disabled
  styles.css      all styling, including a print stylesheet
  app.js          progressive enhancement only
  _headers        security headers
  fonts/          self-hosted, so the page makes no third-party requests
wrangler.jsonc
```

Put the content in the HTML, not in a JavaScript data structure that renders
it. A CV that requires JavaScript to be read is a CV that some readers cannot
read.

`wrangler.jsonc` — note there is no `main`, because there is no Worker script.
Static asset requests are unmetered on the free plan:

```jsonc
{
  "name": "cv",
  "compatibility_date": "2026-09-10",
  "assets": {
    "directory": "./public",
    "not_found_handling": "404-page",
    "html_handling": "auto-trailing-slash"
  }
}
```

## 3. Look at it before shipping it

Render the page and look at the picture. Markup checks pass on layouts that are
visibly broken; two of the three real defects in the original build were
invisible in the HTML and obvious in a screenshot.

If the agent has no browser, one is usually reachable anyway — on WSL2, the
Windows Chrome binary under `/mnt/c/` takes `--headless=new --screenshot` and
`--print-to-pdf`.

## 4. Test the interactive parts

Anything with behaviour deserves a test. `jsdom` runs the page's scripts in
Node without a browser:

```
npm i -D jsdom
node test/*.test.mjs
```

Write the tests before believing the feature works. In the original build, the
suite caught user input reaching `innerHTML` unescaped on its first run.

## 5. Deploy

```bash
npx wrangler login --device --scopes account:read user:read \
  workers:write workers_scripts:write workers_routes:write
npx wrangler deploy
```

`--device` prints a short code to type into the Cloudflare dashboard. Use it
instead of plain `wrangler login`, which opens a localhost callback that a
phone, a container, or a remote session cannot receive.

The result is live at `<name>.<subdomain>.workers.dev`.

### Stage it first

Deploying straight to production is fine for the first push, when there is
nothing to break. After that, upload a version and check it before promoting:

```bash
npx wrangler versions upload    # prints a preview URL; production untouched
# check the preview URL: status codes, a screenshot, the part that changed
npx wrangler versions deploy --yes
```

The preview is a real deployment on the real config, at
`https://<version-prefix>-<name>.<subdomain>.workers.dev`. An agent should
verify there and report what it saw before promoting — not deploy to production
and check afterwards.

## 6. Repository and pipeline

```bash
git init -b main && git add -A && git commit -m "CV site"
gh repo create cv-site --public --source=. --remote=origin --push
```

`.github/workflows/deploy.yml` — the test step gates the deploy, and the deploy
step skips rather than fails when no token is configured, so the pipeline is
green from the first push:

```yaml
name: deploy
on:
  push: { branches: [main] }
  pull_request:
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      HAS_CF_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN != '' }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: npm }
      - run: npm ci
      - run: npm test
      - name: Deploy to Cloudflare
        if: env.HAS_CF_TOKEN == 'true' && github.event_name == 'push' && github.ref == 'refs/heads/main'
        uses: cloudflare/wrangler-action@v4
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

Two repository secrets close the loop:

- `CLOUDFLARE_ACCOUNT_ID` — from `wrangler whoami`.
- `CLOUDFLARE_API_TOKEN` — created at
  dash.cloudflare.com/profile/api-tokens with the **Edit Cloudflare Workers**
  template. This is the one step that cannot be done from a CLI: wrangler's
  OAuth scopes do not include API-token management, so it is a browser visit.
  A phone browser is fine.

## Gotchas that cost real time

- **`wrangler login` fails with `invalid_scope`.** Wrangler 4.131 requests a
  scope list Cloudflare's OAuth client rejects. Use `--device` with an explicit
  `--scopes` list, as above.
- **A strict CSP silently disables inline `style` attributes.** `style-src
  'self'` does not cover them. Layout driven by `style="flex:23"` collapses with
  no console error and no failed request. Put every declaration in the
  stylesheet.
- **Headless Chrome lies about mobile widths.** Windows Chrome clamps its
  window to 500px, so `--window-size=390,800` renders a 500px layout and crops
  the screenshot — which looks exactly like a horizontal-overflow bug. To test a
  real phone width, load the page in a same-origin iframe of that width and
  compare `scrollWidth` with `clientWidth`.
- **Flex items default to `min-width: auto`.** A flex child cannot shrink below
  its content, so one long label forces the whole page wide. Set `min-width: 0`.
- **Cloudflare's edge may serve a stale copy for a few seconds** after a
  deploy. Re-request before concluding the deploy failed.

## Verify, do not assume

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://<your-site>/
curl -sSI https://<your-site>/ | grep -i content-security-policy
```

Check every asset returns 200, the security headers are present, and the page
renders in a screenshot. Then say it is done.
