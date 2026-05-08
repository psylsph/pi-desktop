#!/bin/bash

# Update GitHub repository description and topics
# Usage: ./update-github.sh <github-token>

set -e

REPO="psylsph/pi-desktop"

# Short description (tagline)
DESCRIPTION="A native desktop app for the pi coding agent — your AI pair programmer in a beautiful Electron UI"

# Topics
TOPICS='["desktop-app", "electron", "coding-agent", "developer-tools", "typescript", "ai", "chatbot", "productivity"]'

if [ -z "$1" ]; then
  echo "Usage: $1 <github-token>"
  echo ""
  echo "Get a token at: https://github.com/settings/tokens/new"
  echo "Required scope: public_repo"
  exit 1
fi

TOKEN="$1"

echo "Updating $REPO..."
echo ""

# Update description
echo "Setting description..."
curl -s \
  -X PATCH \
  -H "Authorization: token $TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -d "{\"description\": \"$DESCRIPTION\", \"homepage\": \"https://github.com/psylsph/pi-desktop\", \"has_issues\": true, \"has_projects\": false, \"has_wiki\": false}" \
  "https://api.github.com/repos/$REPO" > /dev/null

echo "✓ Description updated"

# Add topics
echo ""
echo "Adding topics..."
RESPONSE=$(curl -s \
  -X PUT \
  -H "Accept: application/vnd.github.mercy-preview+json" \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"names\": $TOPICS}" \
  "https://api.github.com/repos/$REPO/topics")

if echo "$RESPONSE" | grep -q "names"; then
  echo "✓ Topics added successfully!"
  echo ""
  echo "Current topics:"
  echo "$RESPONSE" | grep -o '"names":\[.*\]' | sed 's/"names"://' | tr ',' '\n' | sed 's/"//g' | sed 's/\[//;s/\]//;s/^/  - /'
else
  echo "✗ Error adding topics:"
  echo "$RESPONSE"
  exit 1
fi

echo ""
echo "✓ All done! Check https://github.com/$REPO"
