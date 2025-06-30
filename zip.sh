VERSION=$(node -p "require('./package.json').version")

mkdir -p zips

npm run build:app:mac:arm64
mv build/ zips/mac-arm

npm run build:app:mac:x64
mv build/ zips/mac-x64

npm run build:app:linux:x64
mv build/ zips/linux-x64

npm run build:app:win:x64
mv build/ zips/win-x64

zip -r zips/QP-$VERSION-windows-x64-installer.zip zips/win-x64
zip -r zips/QP-$VERSION-windows-x64-portable.zip zips/win-x64/win-unpacked
zip zips/QP-$VERSION-macOS-ARM-installer.zip zips/mac-arm/Quantum\ Purse-*-arm64.dmg
zip -r zips/QP-$VERSION-macOS-ARM-portable.zip zips/mac-arm/mac-arm64/
zip zips/QP-$VERSION-macOS-x64-installer.zip zips/mac-x64/Quantum\ Purse-*.dmg
zip -r zips/QP-$VERSION-macOS-x64-portable.zip zips/mac-x64/mac/
zip zips/QP-$VERSION-linux-x64-installer.zip zips/linux-x64/Quantum\ Purse-*.AppImage
zip -r zips/QP-$VERSION-linux-x64-portable.zip zips/linux-x64/linux-unpacked/