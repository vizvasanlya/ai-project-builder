# AI Project Builder

Automated project lifecycle management with Cloudflare Workers, D1 Database, and AI code generation.

## Features

- **Full Project Lifecycle**: Research → Generate → Test → Deploy
- **Dashboard**: Monitor all projects, view stats, configure settings
- **AI Models**: Fetch and use free models from OpenCode Zen
- **Rate Limiting**: Automatic stop when limits reached, resume next cycle
- **Persistent State**: Track progress across sessions with D1 database
- **GitHub Integration**: Auto-create repos, branches, PRs, and merges

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Dashboard (HTML/CSS/JS)              │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Cloudflare Worker (API + Cron)             │
└──────────┬──────────────────┬──────────────────┬────────┘
           │                  │                  │
           ▼                  ▼                  ▼
    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
    │  D1 Database│    │  KV Store   │    │    Queue    │
    │ (Projects,  │    │ (Config,    │    │ (Long tasks)│
    │  History)   │    │  Models)    │    │             │
    └─────────────┘    └─────────────┘    └─────────────┘
```

## Setup

### 1. Prerequisites

- Cloudflare account with Workers, D1, KV, and Queues enabled
- GitHub Personal Access Token with repo scope
- OpenCode Zen API key

### 2. Install dependencies

```bash
npm install
```

### 3. Create D1 Database

```bash
npx wrangler d1 create ai-project-builder-db
```

Copy the database ID and update `wrangler.toml`.

### 4. Create KV Namespace

```bash
npx wrangler kv namespace create KV
```

Copy the namespace ID and update `wrangler.toml`.

### 5. Set secrets

```bash
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put OPENCODE_ZEN_API_KEY
```

### 6. Update configuration

Edit `wrangler.toml` and set your GitHub username:

```toml
[vars]
GITHUB_USERNAME = "your-github-username"
```

### 7. Initialize database

```bash
npm run db:init
```

### 8. Deploy

```bash
npm run deploy
```

### 9. Access dashboard

Visit `https://ai-project-builder.<your-subdomain>.workers.dev`

## How It Works

### Project Lifecycle

1. **Research**: System selects a project type and requirements
2. **Generate**: AI creates production-ready code with tests
3. **Test**: Syntax checks and test validation
4. **Deploy**: Creates GitHub repo, pushes to develop branch, creates PR, merges to main
5. **Track**: All progress saved to database

### Rate Limiting

- Tracks API usage per model per day
- Stops when daily limit reached
- Resumes automatically next cycle
- Dashboard shows current usage

### State Persistence

- Project progress saved to D1
- Can resume interrupted builds
- Full history of all actions
- Error tracking and retry logic

## Dashboard Features

- **Overview**: Stats, recent projects, API usage, errors
- **Projects**: List all projects, create new, view details
- **Configuration**: GitHub username, schedule, limits, testing requirements
- **Models**: Browse available models, test connectivity

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/projects | List all projects |
| POST | /api/projects | Create new project |
| GET | /api/projects/:id | Get project details |
| PUT | /api/projects/:id | Update project |
| DELETE | /api/projects/:id | Delete project |
| GET | /api/stats | Get dashboard stats |
| GET | /api/config | Get configuration |
| PUT | /api/config | Update configuration |
| GET | /api/models | List available models |
| POST | /api/models/test | Test model connectivity |
| POST | /api/trigger | Manually trigger build |

## Development

```bash
npm run dev
```

This starts the worker locally with hot reload.

## Monitoring

View real-time logs:

```bash
npm run tail
```

## License

MIT
