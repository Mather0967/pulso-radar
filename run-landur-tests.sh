#!/usr/bin/env bash
set -e

ROOT="/c/Users/matheusg/.freebuff/worktrees/d3298d16/aca33655-5c30-4ce8-9bd1-f69d8e97858f/projects/landur"
NODE="/c/Users/matheusg/AppData/Local/cursor-agent/versions/2026.10.22-27dcf5f/node.exe"

if [ ! -x "$NODE" ]; then
  echo "NO_NODE" >&2
  exit 1
fi

"$NODE" --test "$ROOT/tests/ledger.test.mjs" "$ROOT/tests/http.test.mjs" 2>&1 | tail -n 120 | sed 's/\r//g'
