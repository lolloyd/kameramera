# Kameramera

A browser photobooth built with Next.js (static export). Photos stay on the device.

## Develop

```bash
npm install
npm run dev
```

Open http://localhost:3000. The camera works on localhost and on HTTPS only.

## Build and deploy to cPanel

1. `npm run package` builds the site into `out/` and writes `kameramera-site.zip`.
2. In cPanel, enable **AutoSSL** (or Let's Encrypt) for the domain.
3. In **File Manager**, open `public_html` (or the subdomain's folder), upload `kameramera-site.zip`, and **Extract** it.
4. Confirm `.htaccess` was extracted (enable "Show Hidden Files" in File Manager settings).
5. Open the site over `https://` and test the camera on desktop and mobile.

### Deploying to a subfolder

Set the base path before building, for example `https://example.com/booth/`:

```bash
NEXT_PUBLIC_BASE_PATH=/booth npm run package
```

On Windows PowerShell: `$env:NEXT_PUBLIC_BASE_PATH="/booth"; npm run package`.
Also change `ErrorDocument 404 /404.html` in `.htaccess` to `/booth/404.html`.

### Optional

- `NEXT_PUBLIC_SITE_URL=https://example.com` sets the absolute URL used for social share images.
- `npm run icons` regenerates the PNG icons and `og-image.png` from `public/logo.svg`.

## Features

Single and strip modes (1x1, 2x2, 4-strip), countdown, filters, frame colours, caption and date, emoji stickers, PNG/JPG download, share, gallery (IndexedDB), photo upload, installable PWA.
