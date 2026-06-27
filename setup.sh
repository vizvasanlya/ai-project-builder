#!/bin/bash

echo "🚀 AI Project Builder - Setup Script"
echo "====================================="

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler not found. Installing..."
    npm install -g wrangler
fi

# Check if logged in
echo "Checking Cloudflare login..."
wrangler whoami || wrangler login

# Create D1 Database
echo ""
echo "📦 Creating D1 Database..."
DB_OUTPUT=$(wrangler d1 create ai-project-builder-db 2>&1)
echo "$DB_OUTPUT"

# Extract database ID
DB_ID=$(echo "$DB_OUTPUT" | grep -oP 'database_id = "\K[^"]+')
if [ -z "$DB_ID" ]; then
    echo "❌ Failed to extract database ID"
    echo "Please manually update wrangler.toml with your database ID"
else
    echo "✅ Database ID: $DB_ID"
    sed -i "s/YOUR_D1_DATABASE_ID/$DB_ID/" wrangler.toml
fi

# Create KV Namespace
echo ""
echo "📦 Creating KV Namespace..."
KV_OUTPUT=$(wrangler kv namespace create KV 2>&1)
echo "$KV_OUTPUT"

# Extract KV ID
KV_ID=$(echo "$KV_OUTPUT" | grep -oP 'id = "\K[^"]+')
if [ -z "$KV_ID" ]; then
    echo "❌ Failed to extract KV ID"
    echo "Please manually update wrangler.toml with your KV namespace ID"
else
    echo "✅ KV ID: $KV_ID"
    sed -i "s/YOUR_KV_NAMESPACE_ID/$KV_ID/" wrangler.toml
fi

# Set secrets
echo ""
echo "🔐 Setting up secrets..."
echo "Please enter your GitHub Personal Access Token:"
wrangler secret put GITHUB_TOKEN

echo "Please enter your OpenCode Zen API Key:"
wrangler secret put OPENCODE_ZEN_API_KEY

# Initialize database
echo ""
echo "🗄️ Initializing database..."
npm run db:init

# Deploy
echo ""
echo "🚀 Deploying worker..."
npm run deploy

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update GITHUB_USERNAME in wrangler.toml with your GitHub username"
echo "2. Run 'npm run deploy' again"
echo "3. Access your dashboard at the deployed URL"
echo ""
echo "For local development:"
echo "npm run dev"
