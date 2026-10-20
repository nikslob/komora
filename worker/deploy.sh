#!/usr/bin/env bash
# Разворачивает сервер синхронизации Коморы в Cloudflare. Перед запуском: npx wrangler login
set -euo pipefail
cd "$(dirname "$0")"
npm ci --silent

id=$(npx wrangler d1 list --json 2>/dev/null | node -e 'let d=JSON.parse(require("fs").readFileSync(0));let db=d.find(x=>x.name==="komora");if(db)console.log(db.uuid)' || true)
if [ -z "$id" ]; then
  npx wrangler d1 create komora
  id=$(npx wrangler d1 list --json | node -e 'console.log(JSON.parse(require("fs").readFileSync(0)).find(x=>x.name==="komora").uuid)')
fi
sed -i "s/^database_id = .*/database_id = \"$id\"/" wrangler.toml
npx wrangler d1 execute komora --remote --file=schema.sql
npx wrangler deploy | tee deploy.log
echo
echo "АДРЕС СЕРВЕРА: $(grep -oE 'https://[a-z0-9.-]+\.workers\.dev' deploy.log | head -1)"
