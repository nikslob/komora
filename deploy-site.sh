#!/usr/bin/env bash
# Выкладывает сайт Коморы в Cloudflare. Перед первым запуском: (cd worker && npx wrangler login)
set -euo pipefail
cd "$(dirname "$0")"
rm -rf .site-dist && mkdir .site-dist
cp -r index.html app.js styles.css sw.js manifest.webmanifest icon.svg icons vendor _headers .site-dist/
worker/node_modules/.bin/wrangler deploy -c site.wrangler.jsonc
