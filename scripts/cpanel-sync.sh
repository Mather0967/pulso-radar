#!/bin/bash
set -euo pipefail
umask 077
DEPLOY_STATE="${HOME}/pulso-deploy"
DEPLOY_REPO="${HOME}/repositories/pulso-radar"
DEPLOY_GIT=/usr/local/cpanel/3rdparty/bin/git
mkdir -p "$DEPLOY_STATE"
exec 9>"$DEPLOY_STATE/sync.lock"
flock -n 9 || exit 0
cd "$DEPLOY_REPO"
# Public repository: no GitHub token, SSH key, webhook or cPanel credential needed.
export GIT_TERMINAL_PROMPT=0
"$DEPLOY_GIT" fetch --quiet origin main
[ "$("$DEPLOY_GIT" branch --show-current)" = main ] || { echo 'Expected main branch'; exit 1; }
"$DEPLOY_GIT" merge --ff-only --quiet origin/main
/bin/bash scripts/cpanel-deploy.sh
