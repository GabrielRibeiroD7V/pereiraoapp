#!/usr/bin/env bash
set -euo pipefail
# Executado como postgres no container efêmero, sem rede e sem volume de dados.
test_root=$(mktemp -d /tmp/pereirao-sql.XXXXXX)
mkdir "$test_root/socket"
cleanup() {
  pg_ctl -D "$test_root/data" -m immediate -w stop >/dev/null 2>&1 || true
}
trap cleanup EXIT
initdb -D "$test_root/data" -A trust -U postgres --no-locale -E UTF8 >/dev/null
pg_ctl -D "$test_root/data" -l "$test_root/postgres.log" -o "-k $test_root/socket -h '' -p 54329" -w start >/dev/null
export PGHOST="$test_root/socket" PGPORT=54329 PGUSER=postgres PGDATABASE=postgres
psql -X -qAt -v ON_ERROR_STOP=1 -f /tests/tests/bootstrap.sql
for migration in /tests/migrations/*.sql; do
  psql -X -qAt -v ON_ERROR_STOP=1 -f "$migration"
done
psql -X -qAt -v ON_ERROR_STOP=1 -f /tests/tests/rls.sql
