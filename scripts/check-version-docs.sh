#!/usr/bin/env bash
set -euo pipefail

# Enforce documentation updates for minor/major version bumps.
# Usage: bash scripts/check-version-docs.sh [base-ref]
# Default base-ref: origin/master

BASE_REF="${1:-origin/master}"

base_version=$(git show "$BASE_REF":package.json | node -p "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).version")
head_version=$(node -p "require('./package.json').version")

IFS='.' read -r base_major base_minor _base_patch <<< "$base_version"
IFS='.' read -r head_major head_minor _head_patch <<< "$head_version"

if [ "$head_major" -gt "$base_major" ]; then
  bump="major"
elif [ "$head_major" -eq "$base_major" ] && [ "$head_minor" -gt "$base_minor" ]; then
  bump="minor"
else
  echo "No minor/major version bump detected ($base_version -> $head_version). Doc check skipped."
  exit 0
fi

echo "Detected $bump version bump: $base_version -> $head_version"
echo ""

required_files=("CLAUDE.md" "CONTRIBUTING.md" "README.md" "docs/website/index.html")
changed_files=$(git diff --name-only "$BASE_REF"...HEAD)
missing=()

for f in "${required_files[@]}"; do
  if ! echo "$changed_files" | grep -qx "$f"; then
    missing+=("$f")
  fi
done

if [ ${#missing[@]} -gt 0 ]; then
  echo "ERROR: Minor/major version bumps require updating ALL release documentation"
  echo "to reflect the new code and functionalities being released."
  echo ""
  echo "Missing updates in:"
  for f in "${missing[@]}"; do
    echo "  - $f"
  done
  echo ""
  echo "Please update these files to document the changes in this release."
  exit 1
fi

echo "All required documentation files are updated."
