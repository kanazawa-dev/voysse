#!/bin/sh
set -eu

test_database=${POSTGRES_TEST_DB:-openvoiss_test}
exists=$(psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align \
  --command "SELECT 1 FROM pg_database WHERE datname = '$test_database'")

if [ "$exists" != "1" ]; then
  createdb --username "$POSTGRES_USER" --owner "$POSTGRES_USER" "$test_database"
fi
