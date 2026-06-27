@echo off
echo 🚀 AI Project Builder - Setup Script
echo =====================================

REM Check if wrangler is installed
where wrangler >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Wrangler not found. Installing...
    call npm install -g wrangler
)

REM Check if logged in
echo Checking Cloudflare login...
call wrangler whoami || call wrangler login

REM Create D1 Database
echo.
echo 📦 Creating D1 Database...
for /f "tokens=*" %%i in ('call wrangler d1 create ai-project-builder-db 2^>^&1') do (
    echo %%i
    echo %%i | findstr "database_id" >nul
    if !errorlevel! equ 0 (
        for /f "tokens=2 delims==" %%j in ("%%i") do set DB_ID=%%~j
    )
)

REM Create KV Namespace
echo.
echo 📦 Creating KV Namespace...
for /f "tokens=*" %%i in ('call wrangler kv namespace create KV 2^>^&1') do (
    echo %%i
    echo %%i | findstr "id" >nul
    if !errorlevel! equ 0 (
        for /f "tokens=2 delims==" %%j in ("%%i") do set KV_ID=%%~j
    )
)

REM Set secrets
echo.
echo 🔐 Setting up secrets...
echo Please enter your GitHub Personal Access Token:
call wrangler secret put GITHUB_TOKEN

echo Please enter your OpenCode Zen API Key:
call wrangler secret put OPENCODE_ZEN_API_KEY

REM Initialize database
echo.
echo 🗄️ Initializing database...
call npm run db:init

REM Deploy
echo.
echo 🚀 Deploying worker...
call npm run deploy

echo.
echo ✅ Setup complete!
echo.
echo Next steps:
echo 1. Update GITHUB_USERNAME in wrangler.toml with your GitHub username
echo 2. Run 'npm run deploy' again
echo 3. Access your dashboard at the deployed URL
echo.
echo For local development:
echo npm run dev
pause
