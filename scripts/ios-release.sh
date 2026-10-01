#!/usr/bin/env bash
# Build HUMM for the App Store and upload it to App Store Connect (TestFlight first).
# Needs: the paid Apple Developer Program team selected in Xcode (App target › Signing), the app
# record com.krishanthasandaruwan.humm in App Store Connect, and the RevenueCat keys in .env.local.
# Usage: npm run ios:release            (archive + upload)
#        npm run ios:release -- --no-upload   (archive only, to check signing)
set -euo pipefail
cd "$(dirname "$0")/.."

# 1. Store purchases must be set up: without the keys the app would show a tester-code unlock.
if ! grep -qE '^VITE_REVENUECAT_IOS_KEY=appl_' .env.local 2>/dev/null; then
  echo "Stop: VITE_REVENUECAT_IOS_KEY (appl_…) is missing in .env.local. See docs/RELEASE.md, step 2." >&2
  exit 1
fi
if grep -qE '^VITE_DEV_PRO=true' .env.local 2>/dev/null; then
  echo "Stop: VITE_DEV_PRO=true is in .env.local — that is a test build. Remove it first." >&2
  exit 1
fi

TEAM=$(grep -m1 'DEVELOPMENT_TEAM = ' ios/App/App.xcodeproj/project.pbxproj | sed -E 's/.*= ([A-Z0-9]+);/\1/')
BUILD=$(date +%Y%m%d%H%M)   # every upload needs a higher build number
OUT=../ios-build/release
mkdir -p "$OUT"

# 2. Web app + native project (store build: no test switches).
npm run build
npx cap sync ios

# 3. Archive (signed by Xcode's automatic signing with your team).
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$OUT/HUMM.xcarchive" \
  -derivedDataPath ../ios-build -clonedSourcePackagesDirPath ../ios-build/spm \
  -allowProvisioningUpdates CURRENT_PROJECT_VERSION="$BUILD" archive

if [[ "${1:-}" == "--no-upload" ]]; then
  echo "Archived build $BUILD in $OUT/HUMM.xcarchive (not uploaded)."
  exit 0
fi

# 4. Upload to App Store Connect.
cat > "$OUT/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>$TEAM</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
</dict></plist>
PLIST
xcodebuild -exportArchive -archivePath "$OUT/HUMM.xcarchive" -exportOptionsPlist "$OUT/ExportOptions.plist" \
  -exportPath "$OUT/export" -allowProvisioningUpdates
echo "Uploaded build $BUILD. It shows up in App Store Connect › TestFlight in a few minutes."
