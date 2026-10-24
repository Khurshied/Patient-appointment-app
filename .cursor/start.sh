#!/usr/bin/env bash
set -euo pipefail

cd /workspace

export DATABASE_URL="${DATABASE_URL:-postgresql://appointments:appointments@localhost:5432/appointments}"
export NODE_ENV="${NODE_ENV:-development}"

if ! command -v pg_isready >/dev/null; then
  echo "PostgreSQL client not found; install postgresql in the environment image." >&2
  exit 1
fi

if ! sudo service postgresql status >/dev/null 2>&1; then
  sudo service postgresql start
fi

until pg_isready -q -h localhost -p 5432; do
  sleep 1
done

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='appointments'" | grep -q 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'
CREATE USER appointments WITH PASSWORD 'appointments' CREATEDB;
SQL
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='appointments'" | grep -q 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE appointments OWNER appointments;"
fi

npx prisma migrate deploy
npx prisma db seed

# Avoid mixing a production `next build` output with `next dev`.
rm -rf .next

if tmux has-session -t next_dev 2>/dev/null; then
  echo "next_dev tmux session already running"
  exit 0
fi

tmux new-session -d -s next_dev "npm run dev -- --hostname 0.0.0.0 --port 3000 2>&1 | tee /tmp/next-dev.log"

for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:3000/api/health" >/dev/null; then
    echo "Next.js dev server is ready on port 3000"
    exit 0
  fi
  sleep 1
done

echo "Timed out waiting for Next.js dev server" >&2
exit 1
