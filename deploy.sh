#!/bin/bash
set -e

echo "🔨 Building..."
npm run build

echo "🚀 Deploying to Vercel..."
vercel --yes --prod

echo "✅ Done! https://menu-maker-gamma.vercel.app"
