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

# Windows
zip -r Quantum-Purse-$VERSION-windows-x64-installer.zip win-x64
zip -r Quantum-Purse-$VERSION-windows-x64-portable.zip win-x64/win-unpacked

# macOS ARM
zip Quantum-Purse-$VERSION-macOS-ARM-installer.zip mac-arm/Quantum\ Purse-*-arm64.dmg
ditto -c -k --sequesterRsrc --keepParent mac-arm/mac-arm64/ Quantum-Purse-$VERSION-macOS-ARM-portable.zip

# macOS x64
zip Quantum-Purse-$VERSION-macOS-x64-installer.zip mac-x64/Quantum\ Purse-*.dmg
ditto -c -k --sequesterRsrc --keepParent mac-x64/mac/ Quantum-Purse-$VERSION-macOS-x64-portable.zip

# Linux
zip Quantum-Purse-$VERSION-linux-x64-installer.zip linux-x64/Quantum\ Purse-*.AppImage
zip -r Quantum-Purse-$VERSION-linux-x64-portable.zip linux-x64/linux-unpacked/