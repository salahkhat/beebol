#!/usr/bin/env bash

set -euo pipefail

if [ -n "${COMPOSER_REPO_URL:-}" ]; then
    echo "Configuring Composer repository: ${COMPOSER_REPO_URL}"
    composer config repositories.visiosoft composer "${COMPOSER_REPO_URL}"

    if [ -n "${COMPOSER_REPO_USERNAME:-}" ] && [ -n "${COMPOSER_REPO_PASSWORD:-}" ]; then
        repo_host="${COMPOSER_REPO_URL#*://}"
        repo_host="${repo_host%%/*}"
        echo "Configuring Composer http-basic auth for: ${repo_host}"
        composer config "http-basic.${repo_host}" "${COMPOSER_REPO_USERNAME}" "${COMPOSER_REPO_PASSWORD}"
    fi
fi

if [ ! -f "vendor/autoload.php" ]; then
    set +e
    composer install --no-progress --no-interaction
    composer_status=$?
    set -e

    if [ "$composer_status" -ne 0 ]; then
        echo ""
        echo "Composer install failed. Common causes:"
        echo "- visiosoft/* packages are hosted on a private Composer repository."
        echo "  Set COMPOSER_REPO_URL (+ COMPOSER_REPO_USERNAME/COMPOSER_REPO_PASSWORD if needed) and restart the containers."
        echo "- If Composer reports security advisories blocking installs, this repo may depend on older Laravel 8 packages."
        echo ""
        exit "$composer_status"
    fi
else
    echo "composer. nothing to do."
fi

if [ ! -f ".env" ]; then
    echo "Creating env file for env from env-sail"
    cp .env-sail .env
else
    echo "env file exists. nothing to do."
fi

# Ensure writable directories exist and are writable. On Windows bind mounts these
# can be read-only or have permission mapping issues; docker-compose mounts these
# paths as volumes, but we still harden permissions here.
mkdir -p storage bootstrap/cache public/app
chmod -R 777 storage bootstrap/cache public/app || true

installed=""
while IFS= read -r line || [[ -n "$line" ]]; do
  if [[ "$line" == "INSTALLED="* ]]; then
    installed="${line#*=}"
    installed=$(echo "$installed" | tr -d '[:space:]' | tr -d '[:punct:]')
    break
  fi
done < .env

if [ "${installed:-}" = "false" ]; then
    echo ".env installed is false starting installing"
    php artisan install --ready
fi

php-fpm -R