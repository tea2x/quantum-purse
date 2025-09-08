# Build and provide build artifacts for all platforms

VERSION=$(node -p "require('./package.json').version")

rm -rf zips
mkdir zips

npm run build:app:mac:arm64
mv build/ zips/mac-arm

npm run build:app:mac:x64
mv build/ zips/mac-x64

npm run build:app:linux:x64
mv build/ zips/linux-x64

npm run build:app:win:x64
mv build/ zips/win-x64

cd zips/

zip -r Quantum-Purse-$VERSION-windows-x64-installer.zip win-x64
zip -r Quantum-Purse-$VERSION-windows-x64-portable.zip win-x64/win-unpacked
zip Quantum-Purse-$VERSION-macOS-ARM-installer.zip mac-arm/Quantum\ Purse-*-arm64.dmg
zip -r Quantum-Purse-$VERSION-macOS-ARM-portable.zip mac-arm/mac-arm64/
zip Quantum-Purse-$VERSION-macOS-x64-installer.zip mac-x64/Quantum\ Purse-*.dmg
zip -r Quantum-Purse-$VERSION-macOS-x64-portable.zip mac-x64/mac/
zip Quantum-Purse-$VERSION-linux-x64-installer.zip linux-x64/Quantum\ Purse-*.AppImage
zip -r Quantum-Purse-$VERSION-linux-x64-portable.zip linux-x64/linux-unpacked/