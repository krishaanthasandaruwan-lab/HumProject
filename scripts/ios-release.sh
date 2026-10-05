#!/usr/bin/env bash
# Build HUMM for the App Store and upload it to App Store Connect (TestFlight first).
# Needs: the paid Apple Developer Program team selected in Xcode (App target › Signing), the app
# record com.krishanthasandaruwan.humm in App Store Connect, and the RevenueCat keys in .env.local.
# Usage: npm run ios:release               (archive only)
#        npm run ios:release -- --upload   (archive + upload)
set -euo pipefail
cd "$(dirname "$0")/.."

# Validate the effective configuration, including shell overrides and .env.release files.
npm run release:check
SDK=$(xcrun --sdk iphoneos --show-sdk-version)
if (( ${SDK%%.*} < 26 )); then
  echo "Stop: App Store submissions require the iOS 26 SDK or later. Installed SDK: $SDK" >&2
  exit 1
fi

TEAM=$(grep -m1 'DEVELOPMENT_TEAM = ' ios/App/App.xcodeproj/project.pbxproj | sed -E 's/.*= ([A-Z0-9]+);/\1/')
BUILD=$(date +%Y%m%d%H%M)   # every upload needs a higher build number
OUT=../ios-build/release
mkdir -p "$OUT"

# 2. Web app + native project (store build: no test switches).
npm run build:release
npx cap sync ios

# 3. Archive (signed by Xcode's automatic signing with your team).
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$OUT/HUMM.xcarchive" \
  -derivedDataPath ../ios-build -clonedSourcePackagesDirPath ../ios-build/spm \
  -allowProvisioningUpdates CURRENT_PROJECT_VERSION="$BUILD" archive

if [[ "${1:-}" != "--upload" ]]; then
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
