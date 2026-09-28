# EasyBill Desktop

EasyBill keeps its existing HTML/CSS/JavaScript interface and can be run as a Windows desktop app through Electron.

## Run locally

Install Node.js 20.19+ or 22.12+, then run:

```powershell
npm install
npm start
```

The desktop shell serves the app at `http://127.0.0.1:5501` so Supabase authentication can use an HTTP redirect origin.

## Build the Windows installer

On a Windows machine, run:

```powershell
npm run dist:win
```

The installer is written to `release/EasyBill-Setup-1.0.0.exe`. The `release/` output is intentionally ignored by Git.

The public download page is `download/index.html`. To publish the page and installer together, upload the `download/` directory and `release/` directory so their relative paths remain unchanged. The download page keeps its button disabled until the installer is present.

## Supabase redirects

In Supabase Dashboard, add these to **Authentication → URL Configuration → Redirect URLs**:

- `http://127.0.0.1:5501/**` for the desktop app
- `http://localhost:5500/**` for the current local web development server
- Your deployed website origin and callback paths when the public site is hosted

Set **Site URL** to the deployed public website origin when available. Keep the browser publishable key in `js/supabase-config.js`; never place a Supabase secret or service-role key in this project.

## Distribution note

The installer is currently unsigned. Windows may show a SmartScreen publisher warning until a code-signing certificate is configured. Users should only install releases downloaded from your official site.