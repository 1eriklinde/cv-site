# Build and deploy a CV site, free, from anywhere

A recipe for an AI coding agent. It produces a static site on Cloudflare
Workers — the CV on one page, any long-form extras on their own URLs — a public
GitHub repository, and a pipeline that runs tests and deploys on every push. Cost: nothing. It works from a terminal, a browser,
or a phone, because no step needs a local machine or a localhost callback.

Written from a session that did exactly this in 24 minutes. The gotchas near
the bottom are the ones that actually cost time — read them before starting,
not after.

## This is a recipe, not a template

Do not reproduce the site this guide came from. Its terminal styling, its
status-line vocabulary and its Nagios-plugin hero were chosen because the person
it belongs to runs monitoring for a fleet of Linux hosts; on anyone else they
are fancy dress. A thousand identical dark terminal CVs would be worth less than
one page that looks like the person it describes.

What to carry over: plain files, no build step, a screenshot before shipping,
tests on anything with behaviour, a strict CSP, and the deploy pipeline. What to
decide fresh, every time: the content, the framing, the typography, the palette,
the structure, and what the page leads with.

So before writing anything, interview the person and read their CV.

## What the person needs

Three free accounts and a browser: GitHub, Cloudflare, and Claude. No payment
card, no domain, no server.

Signing up is mostly clicking through. Where a service offers "continue with
Google", take it rather than filling in a form. GitHub is the exception — it has
no social login, so it wants an email address and a password, or a passkey.
If the person does not have these accounts yet, walk them through creating them
before anything else; it is the only part of this recipe you cannot do for them.

## 0. Before you start

Check what exists before building anything, because the step that fails is
otherwise the last one — after the site is written and deployed.

```bash
node --version        # 20 or newer
git --version
gh --version          # GitHub CLI
npx wrangler --version
```

Nothing here needs installing beyond those: `npx` fetches wrangler on demand.
If `node`, `git` or `gh` is missing, install it or move to an environment that
has them — that is the one thing this recipe cannot route around. "No local
machine required" is true of the sign-ins, not of the tools.

Then sign both CLIs in. Both print a short code to type into a browser, so both
work from a phone and neither needs a localhost callback:

```bash
gh auth login --web                 # code -> github.com/login/device
npx wrangler login --device --scopes account:read user:read \
  workers:write workers_scripts:write workers_routes:write
```

Check them rather than assuming: `gh auth status` and `npx wrangler whoami`
both print who you are. An unauthenticated `gh` does not announce itself until
`gh repo create` fails, which is several steps too late.

Add `d1:write` to the wrangler scopes if the site will use a D1 database. The
list above is the minimum for deploying static assets; a scope that is missing
surfaces as `Authentication error [code: 10000]` from the API, which does not
name the scope it wanted.

## 1. Interview first, build second

Read their CV in full, then get these answered before writing code. They change
the output more than any technical decision does:

- **Who is this person and what are they going for?** Ask what roles they want
  next, not just what they have done. The same history framed two ways reads as
  two different candidates — one CV in this project's own history led with
  display hardware and was reframed around infrastructure operations, and that
  single decision changed more of the page than every styling choice combined.
- **What should it look like, and why that?** A CV site is a design artefact.
  Derive the direction from their field, their materials, their vernacular —
  then say out loud why it suits them. If the honest answer is "because the
  example did it that way", pick again.
- **What should the page lead with?** The most characteristic thing about their
  work, in whatever form fits: a number, a claim, an artefact, a demo.
- **Which contact details should be public?** Email and links, usually. A phone
  number on a crawlable page is a spam magnet — and if their CV PDF carries one,
  serving that PDF publicly leaks it just as effectively.

Propose your reading of the answers and get agreement before building. Guessing
at framing wastes more time than any bug in this guide.

## 2. Build the site

Plain HTML, CSS and JavaScript in a `public/` directory. No framework and no
build step: there is nothing to compile, nothing to keep patched, and the whole
thing deploys as files.

```
public/
  index.html      the CV, as semantic HTML, readable with JS disabled
  <topic>.html    one file per long-form piece, served at /<topic>
  styles.css      all styling, including a print stylesheet
  shared.js       behaviour used on every page
  app.js          progressive enhancement for the CV only
  _headers        security headers
  fonts/          self-hosted, so the page makes no third-party requests
wrangler.jsonc
```

Put the content in the HTML, not in a JavaScript data structure that renders
it. A CV that requires JavaScript to be read is a CV that some readers cannot
read.

Keep the CV a CV. If the site grows a long piece — how it was built, a case
study, a guide — give it its own file and its own URL rather than another
section on the front page. `html_handling: auto-trailing-slash` serves
`public/build.html` at `/build` with no configuration, and a separate page gets
its own `<title>` and description, which is what a reader sees when the link is
pasted into a chat or a feed. A CV that has to be scrolled past three essays is
no longer a CV.

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
npx wrangler deploy
```

Signed in already, in section 0. If that was skipped, `wrangler` will say so
here — use `--device`, never plain `wrangler login`, which opens a localhost
callback that a phone, a container, or a remote session cannot receive.

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
gh auth status                      # fail here, not four commands later
git init -b main && git add -A && git commit -m "CV site"
gh repo create cv-site --public --source=. --remote=origin --push
```

`.github/workflows/deploy.yml` runs the tests, stages a preview, and waits for a
human before production changes. Three jobs: `test`, `preview`, `promote`.

```yaml
name: deploy
on:
  push: { branches: [main] }
  pull_request:
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: npm }
      - run: npm ci
      - run: npm test

  preview:
    needs: test
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    outputs:
      has-token: ${{ steps.gate.outputs.has-token }}
    env:
      HAS_CF_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN != '' }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: npm }
      - run: npm ci
      - id: gate
        run: echo "has-token=$HAS_CF_TOKEN" >> "$GITHUB_OUTPUT"
      - if: env.HAS_CF_TOKEN == 'true'
        id: upload
        uses: cloudflare/wrangler-action@v4
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: versions upload
      - if: env.HAS_CF_TOKEN == 'true'
        env:
          OUT: ${{ steps.upload.outputs.command-output }}
        run: |
          URL=$(printf '%s' "$OUT" | grep -oE 'https://[a-z0-9]+-[a-z0-9-]+\.workers\.dev' | head -1)
          printf '### Preview ready\n\n%s\n' "$URL" >> "$GITHUB_STEP_SUMMARY"

  promote:
    needs: preview
    if: needs.preview.outputs.has-token == 'true'
    runs-on: ubuntu-latest
    environment:
      name: production          # protected: requires approval
      url: https://<your-site>
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: npm }
      - run: npm ci
      - env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: node tools/promote.mjs
```

The gate is a GitHub environment with a required reviewer. Protection rules are
free on public repositories, and the approval button works in the GitHub mobile
app — which is what makes "check it, then accept it" practical from a phone:

```bash
GH_UID=$(gh api user --jq .id)   # note: do not use $UID, it is read-only in zsh
printf '{"wait_timer":0,"prevent_self_review":false,"reviewers":[{"type":"User","id":%s}],"deployment_branch_policy":null}\n' "$GH_UID" > env.json
gh api -X PUT repos/<owner>/<repo>/environments/production --input env.json
```

`tools/promote.mjs` reads `wrangler versions list --json`, takes the newest
upload and deploys it. Do not reach for `wrangler versions deploy --yes` on its
own: `--yes` accepts prompts but still requires a version id, and exits with an
error rather than choosing one.

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
  deploy. Re-request before concluding the deploy failed. A brand-new path can
  404 on one request and return 200 on the next while it propagates.
- **Shared scripts crash on the pages that lack their elements.** A script
  written for one page and loaded on a second will throw on the first
  `document.querySelector(...)` that returns null, and everything after it —
  including unrelated behaviour — silently stops. Guard every lookup, or split
  per-page behaviour from shared behaviour into separate files.
- **A server never sees a URL fragment.** If published links point at
  `#section` and that section becomes its own page, no redirect rule can fix
  them: the browser does not send the `#part`. Map the old fragments to the new
  paths in a script on the page they used to live on.

## Verify, do not assume

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://<your-site>/
curl -sSI https://<your-site>/ | grep -i content-security-policy
```

Check every asset returns 200, the security headers are present, and the page
renders in a screenshot. Then say it is done.
