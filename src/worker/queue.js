import { generateProject } from './generator.js';
import { pushToGitHub } from './github.js';
import { testProject } from './tester.js';

export async function handleQueue(batch, env) {
  for (const message of batch.messages) {
    const { type, projectId } = message.body;
    
    try {
      if (type === 'build') {
        await buildProject(env, projectId);
      } else if (type === 'resume') {
        await resumeProject(env, projectId);
      }
      message.ack();
    } catch (error) {
      console.error(`Queue error for ${projectId}:`, error);
      await handleError(env, projectId, error);
      
      if (isRateLimitError(error)) {
        console.log('Rate limit hit, will retry later');
        message.retry({ delaySeconds: 3600 });
      } else if (isRetryableError(error)) {
        message.retry();
      } else {
        message.ack();
      }
    }
  }
}

async function buildProject(env, projectId) {
  const project = await env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(projectId).first();
  if (!project) {
    console.error(`Project ${projectId} not found`);
    return;
  }

  if (project.status === 'completed') {
    console.log(`Project ${projectId} already completed`);
    return;
  }

  const config = await getConfig(env.KV);
  
  const rateLimitCheck = await checkRateLimit(env, config.selectedModel);
  if (!rateLimitCheck.allowed) {
    throw new Error(`Rate limit exceeded for model ${config.selectedModel}. Resets at ${rateLimitCheck.resetAt}`);
  }

  await updateStatus(env.DB, projectId, 'researching');
  await addHistory(env.DB, projectId, 'research', 'started');

  const research = await researchProject(env, project, config);
  
  await updateStatus(env.DB, projectId, 'generating');
  await addHistory(env.DB, projectId, 'generate', 'started');
  
  const code = await generateProject(env, project, research, config);
  
  for (const file of code.files) {
    await env.DB.prepare(`
      INSERT INTO project_files (project_id, file_path, content, status)
      VALUES (?, ?, ?, 'pending')
    `).bind(projectId, file.path, file.content).run();
  }
  
  await addHistory(env.DB, projectId, 'generate', 'completed', `Generated ${code.files.length} files`);

  await updateStatus(env.DB, projectId, 'testing');
  await addHistory(env.DB, projectId, 'test', 'started');
  
  const testResults = await testProject(env, code, config);
  
  if (!testResults.success) {
    await addHistory(env.DB, projectId, 'test', 'failed', testResults.error);
    throw new Error(`Tests failed: ${testResults.error}`);
  }
  
  await addHistory(env.DB, projectId, 'test', 'completed', 'All tests passed');

  await addHistory(env.DB, projectId, 'push', 'started');
  
  const repo = await pushToGitHub(env, project, code, config);
  
  await env.DB.prepare(`
    UPDATE projects 
    SET status = 'completed', 
        repo_name = ?, 
        repo_url = ?,
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(repo.name, repo.url, projectId).run();

  await addHistory(env.DB, projectId, 'push', 'completed', `Pushed to ${repo.url}`);
  
  await trackUsage(env, config.selectedModel, code);
}

async function resumeProject(env, projectId) {
  const project = await env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(projectId).first();
  if (!project || project.status === 'completed') return;

  const config = await getConfig(env.KV);
  
  if (project.retry_count >= config.maxRetries) {
    await updateStatus(env.DB, projectId, 'failed', 'Max retries exceeded');
    return;
  }

  await env.DB.prepare('UPDATE projects SET retry_count = retry_count + 1 WHERE id = ?').bind(projectId).run();
  
  await buildProject(env, projectId);
}

async function researchProject(env, project, config) {
  const topics = {
    webapp: [
      'Admin dashboard with user management',
      'E-commerce product catalog',
      'Blog with CMS',
      'Real-time chat application',
      'Task management board'
    ],
    cli: [
      'File organizer by type/date',
      'Code snippet manager',
      'Environment variable manager',
      'JSON/YAML converter',
      'Git commit analyzer'
    ],
    library: [
      'Date manipulation utilities',
      'String validation helpers',
      'Data transformation functions',
      'HTTP client wrapper',
      'Cache implementation'
    ],
    api: [
      'REST API boilerplate with auth',
      'GraphQL API starter',
      'Webhook handler',
      'Rate-limited proxy',
      'File upload service'
    ],
    tool: [
      'CSV to JSON converter',
      'Markdown to HTML parser',
      'QR code generator',
      'Password generator',
      'Base64 encoder/decoder'
    ]
  };

  const typeTopics = topics[project.type] || topics.tool;
  const selectedTopic = typeTopics[Math.floor(Math.random() * typeTopics.length)];

  return {
    topic: selectedTopic,
    requirements: [
      'Clean, readable code',
      'Proper error handling',
      'TypeScript support via JSDoc',
      'Unit tests',
      'Comprehensive documentation'
    ],
    techStack: project.type === 'webapp' ? ['HTML', 'CSS', 'JavaScript'] : ['Node.js', 'npm'],
    features: []
  };
}

async function checkRateLimit(env, model) {
  const today = new Date().toISOString().split('T')[0];
  
  const usage = await env.DB.prepare(`
    SELECT tokens_used FROM api_usage WHERE model = ? AND date = ?
  `).bind(model, today).first();

  const DAILY_LIMIT = 100000;
  
  if (usage && usage.tokens_used >= DAILY_LIMIT) {
    return {
      allowed: false,
      resetAt: new Date(new Date().setHours(24, 0, 0, 0)).toISOString(),
      remaining: 0
    };
  }

  return {
    allowed: true,
    remaining: DAILY_LIMIT - (usage?.tokens_used || 0)
  };
}

async function updateStatus(db, projectId, status, errorMessage = null) {
  await db.prepare(`
    UPDATE projects 
    SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(status, errorMessage, projectId).run();
}

async function addHistory(db, projectId, action, status, details) {
  await db.prepare(`
    INSERT INTO build_history (project_id, action, status, details)
    VALUES (?, ?, ?, ?)
  `).bind(projectId, action, status, details || '').run();
}

async function handleError(env, projectId, error) {
  if (!projectId || projectId === 'manual') return;
  
  await env.DB.prepare(`
    UPDATE projects 
    SET status = 'failed', 
        error_message = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(error.message, projectId).run();

  await addHistory(env.DB, projectId, 'error', 'failed', error.message);
}

async function trackUsage(env, model, code) {
  const today = new Date().toISOString().split('T')[0];
  const estimatedTokens = Math.round(JSON.stringify(code).length / 4);
  
  await env.DB.prepare(`
    INSERT INTO api_usage (model, tokens_used, request_count, date)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(model, date) DO UPDATE SET
      tokens_used = tokens_used + ?,
      request_count = request_count + 1
  `).bind(model, estimatedTokens, today, estimatedTokens).run();
}

function isRateLimitError(error) {
  const message = error.message.toLowerCase();
  return message.includes('rate limit') || 
         message.includes('429') || 
         message.includes('quota exceeded');
}

function isRetryableError(error) {
  const message = error.message.toLowerCase();
  return message.includes('timeout') || 
         message.includes('network') || 
         message.includes('503') ||
         message.includes('502');
}

async function getConfig(kv) {
  const stored = await kv.get('config', { type: 'json' });
  return {
    selectedModel: 'gpt-4',
    githubUsername: '',
    requireTests: true,
    autoMergeToMain: true,
    maxRetries: 3,
    ...stored
  };
}
