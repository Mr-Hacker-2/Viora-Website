# Viora website

Static site (no build step). Pages: `index`, `login` (log in + sign up), `account`, `help`, `privacy`, `terms`, `404`.

## Deploy on Render
1. Push this folder to a GitHub repo.
2. Render → New → **Static Site** → pick the repo.
3. Build command: *(leave empty)* · Publish directory: `.`
4. Optional: add a rewrite or set `404.html` as the not-found page (Render serves `404.html` automatically).

## Things to edit — top of `assets/app.js`
- `installUrl`  → your Chrome Web Store link
- `supportEmail` → your real support address
- `authApi`     → your server URL. Empty = demo mode (accounts live in the visitor's browser only).

## Real sign-in (what the extension expects)
The extension opens `<your site>/auth/google?ext=<extension id>` and waits for a redirect to
`https://<ext id>.chromiumapp.org/?token=…&email=…&name=…&picture=…`.
Set `AUTH_SITE` in the extension's `src/lib/access.js` to this site's URL, and implement on your server:
`GET /auth/google`, `POST /auth/login`, `POST /auth/signup` (JSON → `{token,email,name,picture}`).
The login page already forwards `?ext=` and performs the redirect for email sign-in.
