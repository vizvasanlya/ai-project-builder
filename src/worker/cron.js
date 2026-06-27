export async function handleCron(env) {
  const config = await getConfig(env.KV);
  
  if (!config.scheduleEnabled) {
    console.log('Schedule disabled, skipping');
    return { skipped: true, reason: 'Schedule disabled' };
  }

  const hour = new Date().getUTCHours();
  if (hour < config.workingHoursStart || hour >= config.workingHoursEnd) {
    console.log(`Outside working hours (${config.workingHoursStart}-${config.workingHoursEnd})`);
    return { skipped: true, reason: 'Outside working hours' };
  }

  const todayProjects = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM projects 
    WHERE created_at >= date('now') AND status != 'failed'
  `).first();

  if (todayProjects?.count >= config.maxProjectsPerDay) {
    console.log(`Daily limit reached: ${todayProjects?.count}/${config.maxProjectsPerDay}`);
    return { skipped: true, reason: 'Daily limit reached' };
  }

  const stalledProjects = await env.DB.prepare(`
    SELECT * FROM projects 
    WHERE status IN ('pending', 'researching', 'generating', 'testing')
    AND updated_at < datetime('now', '-1 hour')
    LIMIT 1
  `).all();

  if (stalledProjects.results.length > 0) {
    console.log(`Resuming ${stalledProjects.results.length} stalled projects`);
    for (const project of stalledProjects.results) {
      await env.QUEUE.send({ type: 'resume', projectId: project.id });
    }
    return { resumed: stalledProjects.results.length };
  }

  const activeProjects = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM projects 
    WHERE status IN ('pending', 'researching', 'generating', 'testing')
  `).first();

  if (activeProjects?.count > 0) {
    console.log(`${activeProjects.count} projects still in progress`);
    return { skipped: true, reason: 'Projects in progress' };
  }

  const rateLimitCheck = await checkRateLimit(env, config.selectedModel);
  if (!rateLimitCheck.allowed) {
    console.log(`Rate limit hit for ${config.selectedModel}`);
    return { skipped: true, reason: 'Rate limit exceeded' };
  }

  const newProject = await createProjectFromResearch(env, config);
  if (newProject) {
    await env.QUEUE.send({ type: 'build', projectId: newProject.id });
    console.log(`Created new project: ${newProject.id}`);
    return { created: newProject.id };
  }

  return { skipped: true, reason: 'No suitable project found' };
}

async function createProjectFromResearch(env, config) {
  const topics = [
    { type: 'webapp', name: 'dashboard-template', desc: 'Admin dashboard starter' },
    { type: 'cli', name: 'file-organizer', desc: 'CLI file organization tool' },
    { type: 'library', name: 'date-utils', desc: 'Date manipulation utilities' },
    { type: 'api', name: 'rest-starter', desc: 'REST API boilerplate' },
    { type: 'tool', name: 'json-transformer', desc: 'JSON data transformer' },
    { type: 'webapp', name: 'todo-app', desc: 'Full-stack todo application' },
    { type: 'cli', name: 'code-formatter', desc: 'Code formatting CLI' },
    { type: 'library', name: 'validation-lib', desc: 'Data validation library' },
    { type: 'api', name: 'auth-service', desc: 'Authentication service' },
    { type: 'tool', name: 'env-manager', desc: 'Environment variable manager' }
  ];

  const topic = topics[Math.floor(Math.random() * topics.length)];
  const id = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await env.DB.prepare(`
    INSERT INTO projects (id, name, type, status, description)
    VALUES (?, ?, ?, 'pending', ?)
  `).bind(id, topic.name, topic.type, topic.desc).run();

  await addHistory(env.DB, id, 'created', 'success', `Project created: ${topic.name}`);
  
  return await env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first();
}

async function addHistory(db, projectId, action, status, details) {
  await db.prepare(`
    INSERT INTO build_history (project_id, action, status, details)
    VALUES (?, ?, ?, ?)
  `).bind(projectId, action, status, details || '').run();
}

async function checkRateLimit(env, model) {
  const today = new Date().toISOString().split('T')[0];
  
  const usage = await env.DB.prepare(`
    SELECT tokens_used FROM api_usage WHERE model = ? AND date = ?
  `).bind(model, today).first();

  const DAILY_LIMIT = 100000;
  
  if (usage && usage.tokens_used >= DAILY_LIMIT) {
    return { allowed: false };
  }

  return { allowed: true };
}

async function getConfig(kv) {
  const stored = await kv.get('config', { type: 'json' });
  return {
    scheduleEnabled: true,
    workingHoursStart: 9,
    workingHoursEnd: 17,
    maxProjectsPerDay: 3,
    selectedModel: 'big-pickle',
    ...stored
  };
}
