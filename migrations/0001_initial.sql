-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'webapp', 'cli', 'library', 'api'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'researching', 'generating', 'testing', 'completed', 'failed'
  description TEXT,
  repo_name TEXT,
  repo_url TEXT,
  branch TEXT DEFAULT 'develop',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3
);

-- Project files tracking
CREATE TABLE IF NOT EXISTS project_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  content TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'committed', 'tested'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Build history
CREATE TABLE IF NOT EXISTS build_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  action TEXT NOT NULL, -- 'research', 'generate', 'commit', 'test', 'deploy'
  status TEXT NOT NULL, -- 'success', 'failed', 'skipped'
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- API usage tracking
CREATE TABLE IF NOT EXISTS api_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  request_count INTEGER DEFAULT 0,
  date TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Rate limit tracking
CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model TEXT NOT NULL,
  limit_type TEXT NOT NULL, -- 'daily', 'minute', 'hourly'
  remaining INTEGER DEFAULT 0,
  reset_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
