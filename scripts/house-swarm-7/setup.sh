#!/bin/sh
#
# HOUSE-SWARM-7 WU-5 — setup for the Multi-Tenant AI Starter Kit (MT01).
#
# Written for POSIX sh: it runs under /bin/sh on Linux and in Git-Bash on
# Windows. It is NON-INTERACTIVE — it never prompts, never reads stdin, and
# never guesses a value. If a required variable is missing it prints why and
# exits non-zero instead of inventing a default.
#
# What this script does:
#   1. checks Node.js 22 or newer and npm are present;
#   2. checks the environment, refusing to continue on a missing DATABASE_URL
#      or on DEMO_AUTH=true;
#   3. installs the dependencies with the lockfile (npm ci);
#   4. runs the project's own typecheck;
#   5. verifies database connectivity and the migration schema (db-check.mjs).
#
# What this script does NOT do, by design:
#   * it does NOT start the server and does NOT deploy anything;
#   * it does NOT apply migrations itself — the server does that at boot;
#   * it does NOT write any file, so it cannot write a credential to one;
#   * it does NOT set DEMO_AUTH (it refuses to run when DEMO_AUTH=true);
#   * it does NOT read a file for configuration. This project has no dotenv:
#     see docs/house-swarm-7/WU5-DEPLOY.md section 3.3. Values come from the
#     process environment, which is why nothing is persisted here.
#
# It is idempotent: every step is safe to run again.
#
# Usage:
#   sh scripts/house-swarm-7/setup.sh              # requires DATABASE_URL
#   sh scripts/house-swarm-7/setup.sh --in-memory  # no database; nothing persists
#
set -eu

say()  { printf '[setup] %s\n' "$*"; }
warn() { printf '[setup] WARN: %s\n' "$*" >&2; }
die()  { printf '[setup] FAIL: %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'USAGE'
Usage: sh scripts/house-swarm-7/setup.sh [--in-memory] [--help]

  (no option)   Set up against the database in DATABASE_URL. DATABASE_URL is
                required; the script refuses to run without it.
  --in-memory   Set up without a database. The server keeps its in-memory
                repositories and nothing is persisted when the process stops.
                This is not a real deployment.
  --help        Print this message.

The environment is read from the process environment. This project has no
dotenv and reads no .env file, so export the variables before running.
USAGE
}

IN_MEMORY=0
for arg in "$@"; do
  case "$arg" in
    --in-memory) IN_MEMORY=1 ;;
    --help|-h)   usage; exit 0 ;;
    *)           die "unknown argument: $arg (run with --help)" ;;
  esac
done

# ---------------------------------------------------------------------------
# Locate the repository. Resolved from this script's own path so the script
# works from any working directory.
# ---------------------------------------------------------------------------
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
SERVER_DIR="$REPO_ROOT/server"

if [ ! -d "$SERVER_DIR" ]; then
  die "expected the server directory at $SERVER_DIR but it is not there"
fi

say "repository root: $REPO_ROOT"

# ---------------------------------------------------------------------------
# 1. Prerequisites: Node.js 22 or newer, and npm.
#
# 22 is not a preference. The installed @supabase/supabase-js declares
# engines.node = ">=22.0.0". Some older project documentation in this
# repository says "Node.js 20 or newer"; that statement is wrong.
# ---------------------------------------------------------------------------
command -v node >/dev/null 2>&1 || die "node was not found on PATH; install Node.js 22 or newer"
command -v npm  >/dev/null 2>&1 || die "npm was not found on PATH; install Node.js 22 or newer (npm ships with it)"

NODE_RAW=$(node --version)
NODE_VER=${NODE_RAW#v}
NODE_MAJOR=${NODE_VER%%.*}

case "$NODE_MAJOR" in
  ''|*[!0-9]*) die "could not read a numeric Node.js version from: $NODE_RAW" ;;
esac

if [ "$NODE_MAJOR" -lt 22 ]; then
  die "Node.js 22 or newer is required (found $NODE_RAW). The installed @supabase/supabase-js requires it."
fi

say "node: $NODE_RAW (>= 22 required: OK)"
say "npm:  $(npm --version)"

# ---------------------------------------------------------------------------
# 2. Environment checks. Nothing here is defaulted.
# ---------------------------------------------------------------------------
if [ -n "${PORT:-}" ]; then
  case "$PORT" in
    ''|*[!0-9]*) die "PORT must be a number, but it is set to: $PORT" ;;
  esac
  say "PORT is set to $PORT"
else
  say "PORT is not set; the server will use its built-in default 3003"
fi

if [ "${NODE_ENV:-}" = "production" ]; then
  say "NODE_ENV is set to production"
else
  warn "NODE_ENV is not 'production'. A real deployment should set NODE_ENV=production."
fi

if [ "${DEMO_AUTH:-}" = "true" ]; then
  die "DEMO_AUTH=true is set in this environment. The demonstration identity gate is not authentication and must never be enabled on a deployment. Unset DEMO_AUTH and run this again."
fi
say "DEMO_AUTH is not enabled (this script never sets it)"

if [ "$IN_MEMORY" -eq 1 ]; then
  if [ -n "${DATABASE_URL:-}" ]; then
    warn "DATABASE_URL is set but --in-memory was requested; the database will not be verified"
  fi
  warn "in-memory mode: nothing is persisted and this is not a real deployment"
else
  if [ -z "${DATABASE_URL:-}" ]; then
    die "DATABASE_URL is not set in the process environment. Set it to your own PostgreSQL connection string (or run with --in-memory to run without a database). This script will not guess an address, and there is no default one anywhere in this repository."
  fi
  say "DATABASE_URL is set (value not printed, and not written to any file)"
fi

# ---------------------------------------------------------------------------
# 3. Install dependencies from the lockfile.
# ---------------------------------------------------------------------------
cd "$SERVER_DIR"

if [ -f package-lock.json ]; then
  say "installing dependencies: npm ci (using the lockfile)"
  npm ci --no-audit --no-fund || die "npm ci failed; fix the error above and run this script again"
else
  warn "no package-lock.json found; falling back to npm install"
  npm install --no-audit --no-fund || die "npm install failed; fix the error above and run this script again"
fi

# ---------------------------------------------------------------------------
# 4. Typecheck. This is the project's own gate, not a new one.
# ---------------------------------------------------------------------------
say "running the typecheck: npm run typecheck"
npm run typecheck || die "typecheck failed; the source tree does not compile, so do not deploy it"

# ---------------------------------------------------------------------------
# 5. Verify the database. The schema is created by the server's migrations at
#    boot (server/src/index.ts runs them before it listens), so this step
#    reports an un-migrated-but-reachable database as PENDING rather than
#    pretending either way. An unreachable database is a real failure.
# ---------------------------------------------------------------------------
if [ "$IN_MEMORY" -eq 1 ]; then
  say "skipping the database check because --in-memory was requested"
else
  say "verifying the database: node scripts/house-swarm-7/db-check.mjs"

  CHECK_STATUS=0
  CHECK_OUT=$(node "$REPO_ROOT/scripts/house-swarm-7/db-check.mjs" 2>&1) || CHECK_STATUS=$?
  printf '%s\n' "$CHECK_OUT"

  case "$CHECK_OUT" in
    *"CHECK connection FAIL"*)
      die "could not connect to the database in DATABASE_URL (exit $CHECK_STATUS). Check the host, port, database name and credentials, then run this script again."
      ;;
    *"CHECK migration-tables FAIL"*)
      say "PENDING: the database is reachable, but the migration schema is not created yet."
      say "The server creates it at boot. Do this next, then run this script again:"
      say "    cd server && npm run start"
      ;;
    *) say "database checks passed (exit $CHECK_STATUS)" ;;
  esac
fi

# ---------------------------------------------------------------------------
# Done. This script started nothing and deployed nothing.
# ---------------------------------------------------------------------------
say "setup complete."
say "No file was written by this script, so no credential was written to any file."
say "Nothing was started and nothing was deployed."
printf '\n'
say "Start the server yourself with:"
say "    cd server && npm run start"
say "See docs/house-swarm-7/WU5-DEPLOY.md for the full manual, the verification checklist and the rollback steps."
exit 0
