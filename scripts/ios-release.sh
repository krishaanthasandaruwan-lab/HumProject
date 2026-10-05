#!/usr/bin/env bash
# Archive HUMM and export a signed App Store IPA. Upload only with --upload.
# Needs: the paid Apple Developer Program team selected in Xcode (App target › Signing), the app
# record com.krishanthasandaruwan.humm in App Store Connect, and the RevenueCat keys in .env.local.
# Usage: HUMM_BUILD_NUMBER=1 npm run ios:release               (archive + local IPA)
#        HUMM_BUILD_NUMBER=2 npm run ios:release -- --upload   (archive + upload)
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ $# -gt 1 || ( $# -eq 1 && "$1" != "--upload" ) ]]; then
  echo "Usage: HUMM_BUILD_NUMBER=<1–9999> npm run ios:release [-- --upload]" >&2
  exit 1
fi

# Validate the effective configuration, including shell overrides and .env.release files.
npm run release:check
SDK=$(xcrun --sdk iphoneos --show-sdk-version)
if (( ${SDK%%.*} < 26 )); then
  echo "Stop: App Store submissions require the iOS 26 SDK or later. Installed SDK: $SDK" >&2
  exit 1
fi

TEAM=$(grep -m1 'DEVELOPMENT_TEAM = ' ios/App/App.xcodeproj/project.pbxproj | sed -E 's/.*= ([A-Z0-9]+);/\1/')
# Apple's build number components have length limits; a 12-digit timestamp is invalid.
# Require an explicit number so the owner can keep it above all previous uploads.
BUILD=${HUMM_BUILD_NUMBER:-}
if [[ ! "$BUILD" =~ ^[1-9][0-9]{0,3}$ ]]; then
  echo "Set HUMM_BUILD_NUMBER to an unused increasing number from 1 to 9999." >&2
  exit 1
fi
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

# 4. Export locally by default; an upload is an explicit owner action.
DESTINATION=export
if [[ "${1:-}" == "--upload" ]]; then DESTINATION=upload; fi
cat > "$OUT/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>$DESTINATION</string>
  <key>teamID</key><string>$TEAM</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
</dict></plist>
PLIST
xcodebuild -exportArchive -archivePath "$OUT/HUMM.xcarchive" -exportOptionsPlist "$OUT/ExportOptions.plist" \
  -exportPath "$OUT/export" -allowProvisioningUpdates
if [[ "$DESTINATION" == "upload" ]]; then
  echo "Uploaded build $BUILD. Check App Store Connect for processing and TestFlight availability."
else
  echo "Exported build $BUILD to $OUT/export. Use the signed .ipa with Transporter, or upload the archive from Xcode Organizer. Nothing was uploaded."
fi
