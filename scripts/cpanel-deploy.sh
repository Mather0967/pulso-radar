#!/bin/bash
set -euo pipefail
mkdir -p "${HOME}/pulso-deploy"
exec 8>"${HOME}/pulso-deploy/deploy.lock"
flock -n 8 || exit 0
# CloudLinux Node 22, the existing Passenger app's runtime. No package downloads.
for candidate in /opt/alt/alt-nodejs22/root/usr/bin/node "${HOME}/nodevenv/rivect-portal/22/bin/node"; do
  if [ -x "$candidate" ]; then
    exec "$candidate" "$(dirname "$0")/cpanel-deploy.mjs"
  fi
done
echo 'Node 22 runtime was not found; production was not changed.' >&2
exit 1
