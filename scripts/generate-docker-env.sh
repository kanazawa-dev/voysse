#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
target="$project_dir/.env.docker"

if [ -e "$target" ]; then
  echo ".env.docker already exists. It was not overwritten."
  exit 1
fi

umask 077
postgres_password=$(openssl rand -hex 24)
secret_key=$(openssl rand -hex 32)
encryption_key=$(openssl rand -hex 32)
bridge_token=$(openssl rand -hex 32)

{
  echo "POSTGRES_DB=openvoiss"
  echo "POSTGRES_TEST_DB=openvoiss_test"
  echo "POSTGRES_USER=openvoiss"
  echo "POSTGRES_PASSWORD=$postgres_password"
  echo
  echo "SECRET_KEY=$secret_key"
  echo "ENCRYPTION_KEY=$encryption_key"
  echo "WHATSAPP_BRIDGE_TOKEN=$bridge_token"
  echo
  echo "FRONTEND_URL=http://localhost:3000"
  echo "ACCESS_TOKEN_MINUTES=10080"
  echo "WHATSAPP_LOG_LEVEL=silent"
  echo "COOKIE_SECURE=false"
  echo "COOKIE_SAMESITE=lax"
  echo
  echo "# Host ports. Change any that clash with other local services."
  echo "API_PORT=8000"
  echo "WEB_PORT=3000"
  echo "DB_PORT=5432"
  echo "# Bind address: 127.0.0.1 (local only) or 0.0.0.0 (expose on a server)."
  echo "BIND_HOST=127.0.0.1"
} > "$target"

echo "Created .env.docker with private permissions and random secrets."
