import { getProjects, getProject, createProject, updateProject } from './projects.js';
import { getStats } from './stats.js';
import { getConfig, updateConfig } from './config.js';
import { getModels, testModel, clearModelsCache } from './models.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export async function handleApi(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (path === '/api/projects') {
      return handleProjects(request, env);
    }
    if (path.startsWith('/api/projects/') && path.endsWith('/files')) {
      return handleProjectFiles(request, env);
    }
    if (path.startsWith('/api/projects/')) {
      return handleProject(request, env);
    }
    if (path === '/api/stats') {
      return handleStats(env);
    }
    if (path === '/api/activity') {
      return handleActivity(env);
    }
    if (path === '/api/config') {
      return handleConfig(request, env);
    }
    if (path === '/api/models') {
      return handleModels(env);
    }
    if (path === '/api/models/clear-cache' && request.method === 'POST') {
      return handleClearModelsCache(env);
    }
    if (path === '/api/models/test') {
      return handleModelTest(request, env);
    }
    if (path === '/api/trigger') {
      return handleTrigger(request, env);
    }
    if (path === '/api/debug/env') {
      return Response.json({
        hasApiKey: !!env.OPENCODE_ZEN_API_KEY,
        keyLength: env.OPENCODE_ZEN_API_KEY ? env.OPENCODE_ZEN_API_KEY.length : 0,
        keyPrefix: env.OPENCODE_ZEN_API_KEY ? env.OPENCODE_ZEN_API_KEY.substring(0, 8) + '...' : 'none'
      }, { headers: corsHeaders });
    }
    if (path === '/api/debug/test-direct') {
      try {
        var resp = await fetch('https://httpbin.org/get');
        return Response.json({ status: resp.status }, { headers: corsHeaders });
      } catch(e) {
        return Response.json({ error: e.message }, { headers: corsHeaders });
      }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleProjects(request, env) {
  if (request.method === 'GET') {
    const projects = await getProjects(env.DB);
    return Response.json(projects, { headers: corsHeaders });
  }
  if (request.method === 'POST') {
    const body = await request.json();
    const project = await createProject(env.DB, body);
    await env.QUEUE.send({ type: 'build', projectId: project.id });
    return Response.json(project, { status: 201, headers: corsHeaders });
  }
}

async function handleProject(request, env) {
  const id = request.url.split('/').pop();

  if (request.method === 'GET') {
    const project = await getProject(env.DB, id);
    return Response.json(project, { headers: corsHeaders });
  }
  if (request.method === 'PUT') {
    const body = await request.json();
    const project = await updateProject(env.DB, id, body);
    return Response.json(project, { headers: corsHeaders });
  }
  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM project_files WHERE project_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM build_history WHERE project_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(id).run();
    return new Response(null, { status: 204, headers: corsHeaders });
  }
}

async function handleProjectFiles(request, env) {
  const parts = request.url.split('/');
  const projectId = parts[parts.length - 2];

  const files = await env.DB.prepare(
    'SELECT * FROM project_files WHERE project_id = ? ORDER BY file_path'
  ).bind(projectId).all();

  return Response.json(files.results || [], { headers: corsHeaders });
}

async function handleStats(env) {
  const stats = await getStats(env.DB);
  return Response.json(stats, { headers: corsHeaders });
}

async function handleActivity(env) {
  const running = await env.DB.prepare(`
    SELECT id, name, type, status, updated_at
    FROM projects
    WHERE status IN ('pending', 'researching', 'generating', 'testing')
    ORDER BY updated_at DESC
  `).all();

  const recentHistory = await env.DB.prepare(`
    SELECT h.*, p.name as project_name
    FROM build_history h
    LEFT JOIN projects p ON h.project_id = p.id
    ORDER BY h.created_at DESC
    LIMIT 10
  `).all();

  return Response.json({
    activeProjects: running.results || [],
    recentActivity: recentHistory.results || []
  }, { headers: corsHeaders });
}

async function handleConfig(request, env) {
  if (request.method === 'GET') {
    const config = await getConfig(env.KV);
    return Response.json(config, { headers: corsHeaders });
  }
  if (request.method === 'PUT') {
    const body = await request.json();
    await updateConfig(env.KV, body);
    return Response.json({ success: true }, { headers: corsHeaders });
  }
}

async function handleModels(env) {
  const result = await getModels(env);
  return Response.json(result, { headers: corsHeaders });
}

async function handleClearModelsCache(env) {
  await clearModelsCache(env);
  return Response.json({ success: true }, { headers: corsHeaders });
}

async function handleModelTest(request, env) {
  const { model } = await request.json();
  const result = await testModel(env, model);
  return Response.json(result, { headers: corsHeaders });
}

async function handleTrigger(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const topics = [
    { type: 'cli', name: 'file-organizer', desc: 'CLI file organization tool' },
    { type: 'library', name: 'date-utils', desc: 'Date manipulation utilities' },
    { type: 'tool', name: 'json-transformer', desc: 'JSON data transformer' },
    { type: 'api', name: 'rest-starter', desc: 'REST API boilerplate' },
    { type: 'webapp', name: 'todo-app', desc: 'Full-stack todo application' },
    { type: 'cli', name: 'code-formatter', desc: 'Code formatting CLI' },
    { type: 'library', name: 'validation-lib', desc: 'Data validation library' },
    { type: 'tool', name: 'env-manager', desc: 'Environment variable manager' }
  ];

  const topic = topics[Math.floor(Math.random() * topics.length)];
  const id = 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

  await env.DB.prepare(`
    INSERT INTO projects (id, name, type, status, description)
    VALUES (?, ?, ?, 'pending', ?)
  `).bind(id, topic.name, topic.type, topic.desc).run();

  await env.DB.prepare(`
    INSERT INTO build_history (project_id, action, status, details)
    VALUES (?, 'created', 'success', ?)
  `).bind(id, 'Manual trigger: ' + topic.desc).run();

  await env.QUEUE.send({ type: 'build', projectId: id });

  return Response.json({
    triggered: true,
    projectId: id,
    project: topic
  }, { headers: corsHeaders });
}
