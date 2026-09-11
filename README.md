# erik-linde-cv

CV site: the CV itself on `/`, plus three long-form articles on their own
URLs. Static HTML/CSS/JS, no build step, deployed to Cloudflare Workers static
assets (free tier, unmetered asset requests).

## Layout

```
public/            everything that ships
  index.html       the CV — content lives here, not in JS
  build.html       how this site was built            -> /build
  onwards.html     changing it from a phone           -> /onwards
  yours.html       the guide to building your own     -> /yours
  styles.css       all styling, incl. light theme + print
  terminal.js      the command line (CV page only, progressive enhancement)
  chrome.js        clock, copy buttons, old-anchor redirects (every page)
  theme.js         applies a saved theme before paint (no flash)
  404.html         terminal-styled not-found page
  _headers         CSP + security headers, Cloudflare syntax
  guide.md         the recipe, written for someone else's agent to follow
  erik-linde-cv.pdf
  fonts/           self-hosted JetBrains Mono (no third-party requests)
src/index.js       the Worker: one endpoint, /api/hits
schema.sql         the D1 table — one key, one integer
test/shell.test.mjs  jsdom tests for the command line and the counter
wrangler.jsonc     deploy config, asset routing and the D1 binding
```

## Editing the CV

The CV is `public/index.html`; the three long-form articles are their own
pages (`build.html`, `onwards.html`, `yours.html`), served without the `.html`
by `html_handling: auto-trailing-slash`. They were `#anchors` on the CV until
they got their own URLs; `chrome.js` redirects the old fragments, since the
server never sees them.

Edit `public/index.html` directly. The content is semantic HTML, so the page is
fully readable with JavaScript disabled; `terminal.js` reads the DOM rather than
rendering it. If you add a section, give it an `id` and add that id to the
`sections` map in `terminal.js` so `cat <section>` can reach it.

## Commands

```
npm run dev       local server on http://127.0.0.1:8787
npm test          jsdom tests for the command line
npm run timeline  regenerate the build timeline from the session log
npm run stats     re-measure the colophon figures from the files that ship
npm run preview   upload a version and print its preview URL (production untouched)
npm run promote   send the latest uploaded version to production
npm run deploy    build and publish straight to production, skipping the preview
```

## Staging before production

`npm run preview` uploads the current files as a new Worker version and prints a
URL of the form `https://<version-prefix>-cv.<subdomain>.workers.dev`. Production
keeps serving the previous version until you promote. Check the preview URL —
status codes, a screenshot, the sections you changed — then:

```bash
npm run promote
```

`npm run versions` lists what has been uploaded and what is live. This is the
safer default for anything visual: the preview is a real edge deployment on the
real config, not a local approximation.

`npm run timeline` reads the Claude Code session transcript under
`~/.claude/projects/-home-erikl-cv-site/` and rewrites the `#timeline` section
between the `<!-- timeline:start -->` markers in `build.html`. Every figure on
that section — minutes, turns, tool calls, tokens, cost — is measured from the
log rather than typed by hand, so it stays honest if regenerated.

## The view counter

Everything on the site is a static asset, which Cloudflare serves for free and
without invoking a Worker. The one exception is `/api/hits`: `src/index.js`
runs only for that path and increments a single row in a D1 (SQLite) database.
A page view therefore still costs nothing — only the counter call is a billed
Worker request, and the free plan covers 100k a day.

The table is `hits(k TEXT PRIMARY KEY, n INTEGER)` and holds exactly one row.
No address, no user agent, no timestamp, no cookie — which is what lets the
footer still say nothing is stored about the visitor. Two tests enforce that:
they fail if the Worker ever reads a request header or the schema grows an
identifying column.

```bash
npx wrangler d1 execute cv-stats --file=schema.sql          # create the table
npx wrangler d1 execute cv-stats --command "SELECT * FROM hits"
```

`d1:write` must be among the OAuth scopes, which the narrow login below does
not include by default — add it when logging in, or `d1 create` fails with
`Authentication error [code: 10000]`.

## Deploying

Pushing to `main` deploys automatically — see below. To deploy by hand:

```bash
npx wrangler login --device     # once
npm run deploy
```

Live at https://cv.1eriklinde.workers.dev. To use a custom domain, add a
`routes` entry to `wrangler.jsonc` for a zone on your Cloudflare account.

Note: plain `wrangler login` currently fails with `invalid_scope` — wrangler
4.131 asks for scopes the OAuth client rejects. `--device` works, and lets you
narrow the scopes:

```bash
npx wrangler login --device --scopes account:read user:read \
  workers:write workers_scripts:write workers_routes:write d1:write
```

## CI/CD

`.github/workflows/deploy.yml` has three jobs. `test` runs the suite on every
push and pull request. `preview` uploads the build as a new Worker version and
puts its preview URL in the run summary — production is untouched. `promote`
sits behind the `production` environment, which requires an approval, and
deploys that exact version once you give it.

So a push never changes the live site on its own: it stages one, and waits.
Approving works from the GitHub mobile app, which is what makes reviewing a
change from a phone practical.

Both Cloudflare steps skip, rather than fail, when no `CLOUDFLARE_API_TOKEN`
secret exists — the pipeline stays green as a test gate until you add one.
There is no CLI path to minting that first token: wrangler's OAuth scopes do
not include API-token management, so it comes from the dashboard.

Two repository secrets:

| Secret | What |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Create at dash.cloudflare.com/profile/api-tokens with the **Edit Cloudflare Workers** template |
| `CLOUDFLARE_ACCOUNT_ID` | Already set |

```bash
gh secret set CLOUDFLARE_API_TOKEN     # prompts for the value
```

## Notes

- The email address is assembled in JS from `data-` attributes, so it isn't
  sitting in the markup for scrapers. No-JS visitors see `1eriklinde [at] gmail.com`.
- `public/erik-linde-cv.pdf` is generated by printing this site to PDF, so it
  carries no phone number. The original two-page PDF has one and is deliberately
  kept out of this repo — send that one directly to people instead.
  Regenerate after content changes: print the page to PDF from the browser.
- The CSP is strict (`default-src 'none'`, no inline scripts or styles). If you
  add an inline `style="..."` attribute it will be silently dropped — put it in
  `styles.css` instead.
- Printing the page gives a light-theme version with the fixed chrome removed.
