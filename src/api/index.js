import { getProjects, getProject, createProject, updateProject } from './projects.js';
import { getStats, getUsage } from './stats.js';
import { getConfig, updateConfig } from './config.js';
import { getModels, testModel } from './models.js';

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
    if (path.startsWith('/api/projects/')) {
      return handleProject(request, env);
    }
    if (path === '/api/stats') {
      return handleStats(env);
    }
    if (path === '/api/config') {
      return handleConfig(request, env);
    }
    if (path === '/api/models') {
      return handleModels(env);
    }
    if (path === '/api/models/test') {
      return handleModelTest(request, env);
    }
    if (path === '/api/trigger') {
      return handleTrigger(request, env);
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
    await env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(id).run();
    return new Response(null, { status: 204, headers: corsHeaders });
  }
}

async function handleStats(env) {
  const stats = await getStats(env.DB);
  return Response.json(stats, { headers: corsHeaders });
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
  const models = await getModels(env);
  return Response.json(models, { headers: corsHeaders });
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
  await env.QUEUE.send({ type: 'build', projectId: 'manual' });
  return Response.json({ triggered: true }, { headers: corsHeaders });
}
