#!/usr/bin/env bash
# My Care - build and release on the server (docs/DEPLOYMENT.md).
#
#   sudo /var/www/mycare/deploy/deploy.sh            # pull main, build, release
#   sudo SKIP_PULL=1 /var/www/mycare/deploy/deploy.sh  # build what is checked out
#
# Safe to re-run: every step is idempotent. Run as root. Build tools run as
# root; everything the web server reads or writes at runtime is owned by, or
# written as, www-data.
#
# What it does, in order:
#   1. pull the branch (unless SKIP_PULL=1)
#   2. maintenance mode on - the patient app keeps working offline, and a
#      phone that tries to sync gets a 503 and simply retries later
#   3. PHP dependencies, production only
#   4. Node dependencies, then build: engine replay (the API needs it,
#      ADR-0007), the v1 bundle JSON (for the first import), and the three apps
#   5. migrate, stamp the version, cache config and routes
#   6. maintenance mode off, reload PHP-FPM so OPcache picks up the new code

set -euo pipefail

APP_DIR=${APP_DIR:-/var/www/mycare}
BRANCH=${BRANCH:-main}
API="$APP_DIR/apps/api"

export COMPOSER_ALLOW_SUPERUSER=1
export CI=${CI:-}

log() { printf '\n==> %s\n' "$*"; }
as_web() { sudo -u www-data -- "$@"; }
artisan() { (cd "$API" && as_web php artisan "$@"); }

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root (sudo)." >&2
  exit 1
fi

if [ ! -f "$API/.env" ]; then
  echo "$API/.env is missing. Create it from deploy/env.production.example first (DEPLOYMENT.md step 5)." >&2
  exit 1
fi

cd "$APP_DIR"

if [ "${SKIP_PULL:-0}" != "1" ]; then
  log "Pulling $BRANCH"
  git fetch --quiet origin
  git checkout --quiet "$BRANCH"
  git pull --quiet --ff-only origin "$BRANCH"
fi

# The web server must be able to write here before any artisan command runs.
log "Permissions"
chown -R www-data:www-data "$API/storage" "$API/bootstrap/cache"
chmod -R ug+rwX "$API/storage" "$API/bootstrap/cache"
chown root:www-data "$API/.env"
chmod 640 "$API/.env"

FIRST_RUN=0
[ -d "$API/vendor" ] || FIRST_RUN=1

if [ "$FIRST_RUN" = "0" ]; then
  log "Maintenance mode on"
  artisan down --retry=60 || true
fi

log "PHP dependencies"
(cd "$API" && composer install --no-dev --optimize-autoloader --no-interaction --no-progress)

# First deploy only: an empty APP_KEY gets one. Run as root because .env is
# not writable by www-data, on purpose.
if ! grep -q '^APP_KEY=base64:' "$API/.env"; then
  log "Generating APP_KEY"
  (cd "$API" && php artisan key:generate --force)
fi

log "Node dependencies and builds"
npm ci --no-audit --no-fund
npm run build -w @mycare/engine-replay
npm run export:v1 -w @mycare/ruleset
npm run build -w @mycare/pwa
npm run build -w @mycare/portal
npm run build -w @mycare/console

log "Database migrations"
artisan migrate --force

log "Version stamp and caches"
VERSION=$(git -C "$APP_DIR" rev-parse --short HEAD)
sed -i "s/^MYCARE_VERSION=.*/MYCARE_VERSION=$VERSION/" "$API/.env"
artisan optimize:clear >/dev/null
# Not `artisan optimize`: that also caches Blade views, and this API has no
# resources/views - it answers JSON, and PDF reports are built without Blade.
artisan config:cache
artisan route:cache
artisan event:cache

log "Maintenance mode off"
artisan up

if command -v systemctl >/dev/null && systemctl is-active --quiet php8.4-fpm; then
  log "Reloading PHP-FPM"
  systemctl reload php8.4-fpm
fi

log "Deployed $VERSION"
