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
#   3. installs the dependencies with the lockfile (npm ci --include=dev) —
#      devDependencies included on purpose, see the note at step 3;
#   4. runs the project's own typecheck;
#   5. verifies database connectivity and the migration schema (db-check.mjs).
#      The verdict is taken from db-check's EXIT CODE, not from its wording, so
#      a check that fails for an unanticipated reason is a failure here too.
#      See the note at step 5 for how the file is handed to `node`.
#
# What this script does NOT do, by design:
#   * it does NOT start the server and does NOT deploy anything;
#   * it does NOT apply migrations itself — the server does that at boot;
#   * it does NOT write any file, so it cannot write a credential to one;
#   * it does NOT set DEMO_AUTH (it refuses to run when DEMO_AUTH=true);
#   * it does NOT read a file for configuration. This project has no dotenv:
#     see docs/product/WU5-DEPLOY.md section 3.3. Values come from the
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
#
# --include=dev is NOT optional and it is not a convenience. npm honours
# NODE_ENV=production and OMITS devDependencies from an install performed in
# that environment, and this script's own step 2 asks the operator to set
# NODE_ENV=production. `tsx` (which `npm run start` runs) and `typescript`
# (which `npm run typecheck` runs) are devDependencies, so an install without
# them produces a tree that can neither start nor typecheck and this script
# fails at step 4. The flag restores the full, lockfile-pinned tree in every
# NODE_ENV; it adds no dependency and changes no locked version.
# ---------------------------------------------------------------------------
cd "$SERVER_DIR"

if [ -f package-lock.json ]; then
  say "installing dependencies: npm ci --include=dev (using the lockfile, devDependencies included)"
  npm ci --include=dev --no-audit --no-fund || die "npm ci failed; fix the error above and run this script again"
else
  warn "no package-lock.json found; falling back to npm install"
  npm install --include=dev --no-audit --no-fund || die "npm install failed; fix the error above and run this script again"
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
#
#    HOW THE VERDICT IS REACHED. db-check.mjs carries the state in its EXIT CODE,
#    and that code is what this branch reads first:
#
#      exit 0        -> passed, and nothing else needs to be inspected;
#      exit 2        -> PENDING. The database is REACHABLE but the migration
#                       schema is not created yet — a state db-check recognises
#                       itself and reports with its own code. The server creates
#                       the schema at boot, so this is not a failure. The
#                       wording of db-check's output is NOT consulted to decide
#                       this any more.
#      anything else -> failed, and the wording is used only to pick the right
#                       EXPLANATION for a failure that is already established:
#                       the connection case keeps its helpful message, and any
#                       other failure is reported with its real exit code and
#                       db-check's own output, then stops the script. A non-zero
#                       exit other than 2 can never reach a pass branch.
#
#    WHY THE EXIT CODE AND NOT THE TEXT. Recognising PENDING by matching the
#    output text is what this replaces. Any failure whose message was not one of
#    the exact sentences used fell through to "passed" while the script still
#    exited 0. A state that has its own exit code cannot be confused with a
#    message, and db-check only ever emits that code when the connection
#    succeeded and the ONLY failures were the two schema-shaped checks — so a
#    check that fails for any other reason, including one added later, still
#    stops the script.
#
#    THE TWO ARMS REMAIN MUTUALLY EXCLUSIVE, and that is a property of db-check,
#    not an assumption about wording. db-check emits `CHECK connection FAIL` for
#    exactly one thing — a connection that could not be opened at all — and when
#    that happens it skips every later check, so the line cannot appear next to
#    a `CHECK migration-tables` line. It also cannot produce the PENDING exit
#    code, because that arm requires the connection check to have PASSED.
#    It used to be an ordering workaround: on a reachable-but-unmigrated
#    database db-check ran its seed-plan query against a `plans` table that did
#    not exist yet, sent the resulting `relation "plans" does not exist` error to
#    its single catch block, and printed it as `CHECK connection FAIL` directly
#    underneath its own `CHECK connection PASS` line — telling the reader a
#    reachable database had a connection problem. That is fixed in db-check.mjs,
#    which now names every check after the step that actually ran (connection /
#    migration-tables / seed-plans), does not run the seed-plan query before the
#    tables it reads exist, and reports that check as not run instead.
#
#    WHY THERE IS NO DUPLICATE FAILURE LINE HERE. db-check prints one line per
#    check and its own closing summary, and this script prints db-check's output
#    verbatim. On a reachable-but-unmigrated database that output contains
#    `CHECK migration-tables PENDING …` and `CHECK seed-plans PENDING not run: …` — the
#    honest statement of what was not done — and this script adds only the
#    PENDING sentence, so the reader sees the state named once and the individual
#    checks once, never the same verdict twice in contradictory senses.
#
#    HOW THE FILE IS HANDED TO `node`. The path is RELATIVE to the repository
#    root and never absolute. On Windows/Git-Bash the absolute path this script
#    computes is a POSIX path such as /d/path/to/project/... ; `node` is a native
#    program and does not translate it, so it looked the file up under the
#    current drive (D:\d\path\to\project\...\db-check.mjs) and the step failed with
#    MODULE_NOT_FOUND — and then reported that failure as a pass. A relative
#    path has no drive letter and no leading slash to mistranslate, so it
#    resolves identically under Git-Bash on Windows and under POSIX sh on Linux.
#    It is also exactly the command docs/product/WU5-DEPLOY.md §5 tells the
#    operator to run by hand, and db-check.mjs resolves its own location, so it
#    does not care which directory it is started from.
# ---------------------------------------------------------------------------
if [ "$IN_MEMORY" -eq 1 ]; then
  say "skipping the database check because --in-memory was requested"
else
  DB_CHECK_REL="scripts/house-swarm-7/db-check.mjs"

  if [ ! -f "$REPO_ROOT/$DB_CHECK_REL" ]; then
    die "$DB_CHECK_REL was not found under $REPO_ROOT, so the database cannot be verified. The distribution is incomplete; do not treat this database as checked."
  fi

  say "verifying the database: node $DB_CHECK_REL (run from the repository root)"

  cd "$REPO_ROOT"
  CHECK_STATUS=0
  CHECK_OUT=$(node "$DB_CHECK_REL" 2>&1) || CHECK_STATUS=$?
  printf '%s\n' "$CHECK_OUT"

  if [ "$CHECK_STATUS" -eq 0 ]; then
    say "database checks passed (db-check exited 0)"
  elif [ "$CHECK_STATUS" -eq 2 ]; then
    # PENDING — db-check's own intermediate state, carried in its exit code.
    # Intentional and documented (scripts/house-swarm-7/setup.md §3.3): the
    # database is reachable, the migration schema is not created yet, and the
    # server creates it at boot. db-check printed the two schema checks as FAIL
    # above, which is the honest per-check record; the state is named ONCE here
    # rather than repeated, and the script does not stop.
    say "PENDING: the database is reachable, but the migration schema is not created yet."
    say "The server creates it at boot. Do this next, then run this script again:"
    say "    cd server && npm run start"
  else
    case "$CHECK_OUT" in
      *"CHECK connection FAIL"*)
        # The connection could not be opened at all. db-check stops at that
        # point, so this is the only failure it reported, and it is the one
        # explanation worth adding to db-check's own line.
        die "could not connect to the database in DATABASE_URL (db-check exited $CHECK_STATUS). Check the host, port, database name and credentials, then run this script again."
        ;;
      *)
        # Any other failure. The exit code is the verdict, so this is a failure;
        # db-check's own output is printed verbatim above.
        die "the database check failed (db-check exited $CHECK_STATUS) and reported a result this script does not recognise. Read db-check's output printed above and fix it before deploying; this script will not treat it as a pass."
        ;;
    esac
  fi
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
say "See docs/product/WU5-DEPLOY.md for the full manual, the verification checklist and the rollback steps."
exit 0
