# Viora website
Static site, no build step. Pages: index, login (Google), account, help, privacy, terms, 404.

## Deploy (Render → Static Site)
Build command: empty. Publish directory: `.`

## Edit at the top of `assets/app.js`
- `installUrl`: your Chrome Web Store link
- `supportEmail`: your real support address
- `authApi`: your Google sign-in server (set to viora-auth-website.onrender.com)

## Auth server settings (Render environment variables)
`SITE_URL` must be this site's exact URL, with no trailing slash.
