#!/bin/bash

set -e  # Exit on error

echo "=========================================="
echo "DMX Controller - macOS Packaging Script"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${BLUE}Current version: ${CURRENT_VERSION}${NC}"

# Increment patch version (e.g., 1.0.0 -> 1.0.1)
IFS='.' read -r -a version_parts <<< "$CURRENT_VERSION"
MAJOR="${version_parts[0]}"
MINOR="${version_parts[1]}"
PATCH="${version_parts[2]}"

# Increment patch number
PATCH=$((PATCH + 1))
NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"

echo -e "${GREEN}New version: ${NEW_VERSION}${NC}"

# Update version in package.json
npm version "$NEW_VERSION" --no-git-tag-version

echo ""
echo -e "${BLUE}Step 1/5: Installing dependencies...${NC}"
npm install

echo ""
echo -e "${BLUE}Step 2/5: Rebuilding native modules...${NC}"
npm run rebuild

echo ""
echo -e "${BLUE}Step 3/5: Building application...${NC}"
npm run build

echo ""
echo -e "${BLUE}Step 4/5: Packaging for macOS (Apple Silicon)...${NC}"
# Set environment variables for adhoc signing
export CSC_IDENTITY_AUTO_DISCOVERY=false
npm run package

echo ""
echo -e "${BLUE}Step 5/5: Locating build artifacts...${NC}"

# Find the generated files
DMG_FILE=$(find dist -name "*.dmg" -type f | head -n 1)
APP_FILE=$(find dist/mac-arm64 -name "*.app" -type d | head -n 1)

if [ -n "$DMG_FILE" ]; then
    echo -e "${GREEN}✓ DMG created: ${DMG_FILE}${NC}"
    # Get file size
    DMG_SIZE=$(du -h "$DMG_FILE" | cut -f1)
    echo -e "  Size: ${DMG_SIZE}"
fi

if [ -n "$APP_FILE" ]; then
    echo -e "${GREEN}✓ App bundle created: ${APP_FILE}${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Packaging complete!${NC}"
echo "=========================================="
echo -e "Version: ${GREEN}${NEW_VERSION}${NC}"
echo -e "Target: ${BLUE}macOS (Apple Silicon)${NC}"
echo -e "Signing: ${BLUE}Ad-hoc${NC}"
echo ""
echo "Build artifacts are in the 'dist' directory"
echo "=========================================="
