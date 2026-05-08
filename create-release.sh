#!/bin/bash

# Create a GitHub release via API
# Usage: ./create-release.sh <github-token> <tag> <title>

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <github-token> [tag] [title]"
  echo ""
  echo "Examples:"
  echo "  $0 TOKEN v0.1.0"
  echo "  $0 TOKEN v0.2.0 'Version 0.2.0 - New Features'"
  exit 1
fi

TOKEN="$1"
TAG="${2:-$(git describe --tags --abbrev=0 2>/dev/null || echo 'v0.1.0')}"
TITLE="${3:-$TAG}"
REPO="psylsph/pi-desktop"

# Get release notes from CHANGELOG if available
if [ -f "CHANGELOG.md" ]; then
  RELEASE_NOTES=$(sed -n "/## \[$TAG\]/,/## \[/p" CHANGELOG.md | head -n -1 | sed '1d')
  if [ -z "$RELEASE_NOTES" ]; then
    RELEASE_NOTES="See [CHANGELOG.md](https://github.com/$REPO/blob/main/CHANGELOG.md) for details."
  fi
else
  RELEASE_NOTES="Release $TAG"
fi

echo "Creating release $TAG for $REPO..."
echo ""

# Create the release
RESPONSE=$(curl -s \
  -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -d "{
    \"tag_name\": \"$TAG\",
    \"target_commitish\": \"main\",
    \"name\": \"$TITLE\",
    \"body\": $(echo "$RELEASE_NOTES" | jq -Rs .),
    \"draft\": false,
    \"prerelease\": false
  }" \
  "https://api.github.com/repos/$REPO/releases")

if echo "$RESPONSE" | grep -q "html_url"; then
  URL=$(echo "$RESPONSE" | grep -o '"html_url": "[^"]*"' | cut -d'"' -f4)
  echo "✓ Release created successfully!"
  echo "  URL: $URL"
else
  echo "✗ Error creating release:"
  echo "$RESPONSE"
  exit 1
fi
