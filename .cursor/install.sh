#!/usr/bin/env bash
set -euo pipefail

cd /workspace

if [ ! -f .env ]; then
  cp .env.example .env
fi

# Prisma generate (postinstall) only needs a syntactically valid URL.
export DATABASE_URL="${DATABASE_URL:-postgresql://build:build@127.0.0.1:5432/build}"

npm ci
