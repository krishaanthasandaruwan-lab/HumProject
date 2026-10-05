#!/bin/sh
# Xcode's Archive path must not bypass Vite's owner-configuration/test-build checks.
set -eu
if [ "${CONFIGURATION:-}" != "Release" ] || [ "${ACTION:-}" != "install" ]; then
  exit 0
fi
marker="${SRCROOT}/App/public/humm-release.json"
ready=$(/usr/bin/plutil -extract ready raw -o - "$marker" 2>/dev/null || true)
mode=$(/usr/bin/plutil -extract mode raw -o - "$marker" 2>/dev/null || true)
if [ "$ready" != "true" ] || [ "$mode" != "release" ]; then
  echo 'error: Build validated store assets with npm run build:release and npx cap sync ios before archiving.' >&2
  exit 1
fi
