#!/usr/bin/env bash
set -euo pipefail

# Sync the version from package.json into docs/website/index.html.
# Usage: bash scripts/sync-website-version.sh

WEBSITE="docs/website/index.html"
VERSION=$(node -p "require('./package.json').version")

if [ ! -f "$WEBSITE" ]; then
  echo "ERROR: $WEBSITE not found"
  exit 1
fi

# Update hero badge: "· v<old>" → "· v<new>"
sed -i "s/· v[0-9]\+\.[0-9]\+\.[0-9]\+/· v${VERSION}/g" "$WEBSITE"

# Update footer release line: "v<old> ·" → "v<new> ·"
sed -i "s/release: v[0-9]\+\.[0-9]\+\.[0-9]\+/release: v${VERSION}/g" "$WEBSITE"

echo "Synced website version to v${VERSION}"
