# erik-linde-cv

Single-page CV site. Static HTML/CSS/JS, no build step, deployed to Cloudflare
Workers static assets (free tier, unmetered asset requests).

## Layout

```
public/            everything that ships
  index.html       the CV — content lives here, not in JS
  styles.css       all styling, incl. light theme + print
  terminal.js      the command line (progressive enhancement)
  theme.js         applies a saved theme before paint (no flash)
  404.html         terminal-styled not-found page
  _headers         CSP + security headers, Cloudflare syntax
  erik-linde-cv.pdf
  fonts/           self-hosted JetBrains Mono (no third-party requests)
test/shell.test.mjs  jsdom tests for the command line
wrangler.jsonc     deploy config
```

## Editing the CV

Edit `public/index.html` directly. The content is semantic HTML, so the page is
fully readable with JavaScript disabled; `terminal.js` reads the DOM rather than
rendering it. If you add a section, give it an `id` and add that id to the
`sections` map in `terminal.js` so `cat <section>` can reach it.

## Commands

```
npm run dev      local server on http://127.0.0.1:8787
npm test         jsdom tests for the command line
npm run deploy   publish to Cloudflare
```

## Deploying

```bash
npx wrangler login     # once, browser OAuth
npm run deploy
```

Deploys to `cv.<your-subdomain>.workers.dev`. To use a custom domain,
add a `routes` entry to `wrangler.jsonc` for a zone on your Cloudflare account.

## Notes

- The email address is assembled in JS from `data-` attributes, so it isn't
  sitting in the markup for scrapers. No-JS visitors see `1eriklinde [at] gmail.com`.
- The CSP is strict (`default-src 'none'`, no inline scripts or styles). If you
  add an inline `style="..."` attribute it will be silently dropped — put it in
  `styles.css` instead.
- Printing the page gives a light-theme version with the fixed chrome removed.
