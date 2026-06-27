# AI Project Builder - Complete Setup Guide

## What This System Does

This is a **fully automated project lifecycle manager** that:

1. **Researches** what to build (picks project type randomly)
2. **Generates** production-ready code using AI
3. **Tests** the code (syntax, structure, tests)
4. **Deploys** to GitHub (repo, branches, PR, merge)
5. **Tracks** everything in a database
6. **Resumes** if interrupted (rate limits, errors, daily limits)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     YOUR BROWSER                                │
│                  https://your-worker.workers.dev                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              CLOUDFLARE WORKER (Single Deployment)              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Static Assets  │  │   API Routes    │  │  Cron Trigger   │ │
│  │  (Dashboard)    │  │   /api/*        │  │  (Every Hour)   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└──────────┬──────────────────┬──────────────────┬────────────────┘
           │                  │                  │
           ▼                  ▼                  ▼
    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
    │  D1 Database│    │  KV Store   │    │    Queue    │
    │             │    │             │    │             │
    │ • projects  │    │ • config    │    │ • build     │
    │ • files     │    │ • models    │    │ • resume    │
    │ • history   │    │ • state     │    │             │
    │ • usage     │    │             │    │             │
    └─────────────┘    └─────────────┘    └─────────────┘
           │                                      │
           ▼                                      ▼
    ┌─────────────┐                      ┌─────────────┐
    │  GitHub API │                      │ OpenCode Zen│
    │             │                      │     API     │
    │ • repos     │                      │             │
    │ • commits   │                      │ • models    │
    │ • PRs       │                      │ • generate  │
    └─────────────┘                      └─────────────┘
```

---

## Prerequisites

1. **Cloudflare Account** (Free tier works)
2. **GitHub Personal Access Token** (with `repo` scope)
3. **OpenCode Zen API Key** (free models available)

---

## Step-by-Step Setup

### 1. Install Dependencies

```bash
cd D:\GPC\ai-project-builder
npm install
```

### 2. Login to Cloudflare

```bash
npx wrangler login
```

### 3. Create D1 Database

```bash
npx wrangler d1 create ai-project-builder-db
```

Copy the output and update `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "ai-project-builder-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # <-- Paste here
```

### 4. Create KV Namespace

```bash
npx wrangler kv namespace create KV
```

Copy the output and update `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  # <-- Paste here
```

### 5. Set Secrets

```bash
# GitHub token
npx wrangler secret put GITHUB_TOKEN
# Paste your token when prompted

# OpenCode Zen API key
npx wrangler secret put OPENCODE_ZEN_API_KEY
# Paste your API key when prompted
```

### 6. Update GitHub Username

Edit `wrangler.toml`:
```toml
[vars]
GITHUB_USERNAME = "your-actual-github-username"
```

### 7. Initialize Database

```bash
npm run db:init
```

### 8. Test Locally

```bash
npm run dev
```

Visit `http://localhost:8787` to see the dashboard.

### 9. Deploy

```bash
npm run deploy
```

Your dashboard will be at:
```
https://ai-project-builder.YOUR_SUBDOMAIN.workers.dev
```

---

## Dashboard Features

### Overview Tab
- **Stats Cards**: Total, Completed, In Progress, Failed
- **Recent Projects**: Last 10 projects with status
- **API Usage**: Token usage by model (last 7 days)
- **Common Errors**: Top error messages

### Projects Tab
- **New Project**: Create manually
- **Trigger Build**: Force immediate build
- **Project List**: All projects with status
- **Project Details**: Click to see history, files, errors

### Configuration Tab
- **GitHub Username**: Your GitHub handle
- **Schedule Enabled**: Turn auto-build on/off
- **Max Projects Per Day**: Limit daily builds (1-10)
- **Require Tests**: Ensure tests are generated
- **Auto Merge to Main**: Skip PR review

### Models Tab
- **Available Models**: List from OpenCode Zen
- **Free Models**: Badge showing which are free
- **Test Model**: Verify API connectivity

---

## How It Works

### Daily Flow

```
Every Hour (Cron Trigger)
         │
         ▼
┌────────────────────────────┐
│  1. Check Schedule         │
│  • Enabled?                │
│  • Working hours?          │
│  • Daily limit reached?    │
└────────────┬───────────────┘
             │
             ▼
┌────────────────────────────┐
│  2. Check for Stalled      │
│  • Projects stuck > 1 hour │
│  • Resume from last step   │
└────────────┬───────────────┘
             │
             ▼
┌────────────────────────────┐
│  3. Check Rate Limits      │
│  • API usage today         │
│  • Stop if limit hit       │
└────────────┬───────────────┘
             │
             ▼
┌────────────────────────────┐
│  4. Create New Project     │
│  • Pick random type/topic  │
│  • Save to database        │
│  • Queue for building      │
└────────────┬───────────────┘
             │
             ▼
┌────────────────────────────┐
│  5. Build Project          │
│  • Research                │
│  • Generate code (AI)      │
│  • Test                    │
│  • Push to GitHub          │
└────────────────────────────┘
```

### State Persistence

Every step is saved to D1 database:
- **projects**: Current status, repo info, errors
- **project_files**: All generated files
- **build_history**: Complete audit trail
- **api_usage**: Token usage tracking

If interrupted (rate limit, error, timeout):
1. Status saved as current step
2. Next cron cycle detects stalled project
3. Resumes from where it left off
4. Retries up to 3 times

### Rate Limiting

- Tracks daily token usage per model
- Stops when limit reached (default: 100K tokens/day)
- Waits until next day to resume
- Dashboard shows current usage

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/projects` | List all projects |
| `POST` | `/api/projects` | Create new project |
| `GET` | `/api/projects/:id` | Get project details |
| `PUT` | `/api/projects/:id` | Update project |
| `DELETE` | `/api/projects/:id` | Delete project |
| `GET` | `/api/stats` | Get dashboard statistics |
| `GET` | `/api/config` | Get configuration |
| `PUT` | `/api/config` | Update configuration |
| `GET` | `/api/models` | List available models |
| `POST` | `/api/models/test` | Test model connectivity |
| `POST` | `/api/trigger` | Manually trigger build |

---

## Troubleshooting

### "Rate limit exceeded"
- Check Models tab for usage
- Wait until tomorrow or change model

### "Project stuck in researching"
- Check build history for errors
- Click "Trigger Build" to retry

### "GitHub push failed"
- Verify GITHUB_TOKEN has `repo` scope
- Check GitHub username is correct

### "Model not available"
- Models tab shows available models
- Click "Refresh Models" to update list
- Test model connectivity

---

## Cost

**Cloudflare Free Tier Includes:**
- 100,000 Worker requests/day
- 100,000 D1 reads/day
- 100,000 D1 writes/day
- 100,000 KV reads/day
- 1,000 KV writes/day
- 1,000 Queue messages/day

**This system uses:**
- ~24-48 Worker requests/day (hourly cron + builds)
- ~100-500 D1 operations/day (project tracking)
- ~10-50 KV operations/day (config reads)
- ~3-10 Queue messages/day (project builds)

**Estimated cost: $0/month** on free tier

---

## Customization

### Change Project Topics
Edit `src/worker/cron.js` → `topics` array

### Change Working Hours
Edit config in dashboard or `src/worker/cron.js`

### Change Daily Limit
Edit config in dashboard or `wrangler.toml`

### Add New Project Types
1. Add type to `topics` array in `cron.js`
2. Add generation prompt in `generator.js`
3. Add test cases in `tester.js`

---

## Next Steps

1. Deploy and test with one manual project
2. Monitor dashboard for first few builds
3. Adjust configuration as needed
4. Add custom project topics
5. Set up alerts for failures (optional)

---

## Support

- Check dashboard for real-time status
- View logs: `npm run tail`
- Database: Query D1 directly
- GitHub: Check repo creation
