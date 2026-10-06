#!/usr/bin/env bash
#
# Deploy FF Desk to Cloudflare Pages (direct upload, FF account) — https://ff-desk.pages.dev
#
#   npm run deploy                    # production
#   FF_BRANCH=preview npm run deploy  # preview alias, production untouched
#
# Pushing to GitHub deploys nothing. wrangler ≥ 4.13x needs --force to keep the legacy Pages path.
# Credentials: the FF brand repo's .env (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID).
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT="${FF_PROJECT:-ff-desk}"
BRANCH="${FF_BRANCH:-main}"
ENV_FILE="${FF_ENV:-}"
if [ -z "$ENV_FILE" ]; then
  for f in "$HOME/Desktop/dev/ffdevstudio/.env" "/c/Dev/ffdevstudio/.env" "C:/Dev/ffdevstudio/.env"; do [ -f "$f" ] && ENV_FILE="$f" && break; done
fi
[ -f "$ENV_FILE" ] || { echo "✗ no FF credentials found (set FF_ENV)"; exit 1; }
set -a; . "$ENV_FILE"; set +a
: "${CLOUDFLARE_API_TOKEN:?missing in $ENV_FILE}"
: "${CLOUDFLARE_ACCOUNT_ID:?missing in $ENV_FILE}"

npm run build

npx --yes wrangler@latest pages project list 2>/dev/null | grep -q "│ $PROJECT " \
  || npx --yes wrangler@latest pages project create "$PROJECT" --production-branch main --force

npx --yes wrangler@latest pages deploy out --project-name "$PROJECT" --branch "$BRANCH" --commit-dirty=true --force
