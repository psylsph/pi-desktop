#!/bin/bash

# Add topics to GitHub repository via API
# Usage: ./add-topics.sh <github-token>

set -e

REPO="psylsph/pi-desktop"
TOPICS='["desktop-app", "electron", "coding-agent", "developer-tools", "typescript", "ai", "chatbot"]'

if [ -z "$1" ]; then
  echo "Usage: $0 <github-token>"
  echo ""
  echo "Get a token at: https://github.com/settings/tokens"
  echo "Required scope: public_repo (for public repos)"
  exit 1
fi

TOKEN="$1"

echo "Adding topics to $REPO..."
echo "Topics: $TOPICS"
echo ""

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
  echo "$RESPONSE" | grep -o '"names":\[.*\]' | sed 's/"names"://' | tr ',' '\n' | sed 's/"/  - /g' | sed 's/\[//;s/\]//'
else
  echo "✗ Error adding topics:"
  echo "$RESPONSE"
  exit 1
fi
