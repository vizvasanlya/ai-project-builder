const API_BASE = '';

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadOverview();
  loadConfig();
  loadModels();
  initEventListeners();
  setInterval(loadActivity, 5000);
});

function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');

      if (tab.dataset.tab === 'projects') loadProjects();
      if (tab.dataset.tab === 'overview') { loadOverview(); loadActivity(); }
    });
  });
}

function initEventListeners() {
  document.getElementById('btn-new-project').addEventListener('click', showNewProjectModal);
  document.getElementById('btn-trigger-build').addEventListener('click', triggerBuild);
  document.getElementById('btn-refresh-models').addEventListener('click', loadModels);
  document.getElementById('btn-clear-cache').addEventListener('click', clearModelsCache);
  document.getElementById('config-form').addEventListener('submit', saveConfig);

  document.querySelector('.close').addEventListener('click', () => {
    document.getElementById('modal').classList.add('hidden');
  });
}

async function loadOverview() {
  try {
    const stats = await fetchAPI('/api/stats');

    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-completed').textContent = stats.completed;
    document.getElementById('stat-pending').textContent = stats.pending;
    document.getElementById('stat-failed').textContent = stats.failed;

    renderRecentProjects(stats.recentProjects);
    renderApiUsage(stats.apiUsage);
    renderErrors(stats.topErrors);
  } catch (error) {
    console.error('Failed to load overview:', error);
  }
}

async function loadActivity() {
  const container = document.getElementById('activity-feed');
  if (!container) return;

  try {
    const data = await fetchAPI('/api/activity');

    if (data.activeProjects.length === 0 && data.recentActivity.length === 0) {
      container.innerHTML = '<p style="color: var(--text-secondary);">No activity yet</p>';
      return;
    }

    let html = '';

    if (data.activeProjects.length > 0) {
      html += '<h3 style="margin-bottom: 10px; color: var(--warning);">Currently Running</h3>';
      html += data.activeProjects.map(p => `
        <div class="project-card" style="border-left: 3px solid var(--warning);">
          <div class="project-info">
            <h3>${p.name}</h3>
            <p>${p.type} — Status: <strong>${p.status}</strong></p>
          </div>
          <span class="project-status status-${p.status}">${p.status}</span>
        </div>
      `).join('');
    }

    if (data.recentActivity.length > 0) {
      html += '<h3 style="margin: 15px 0 10px; color: var(--text-secondary);">Recent Activity</h3>';
      html += data.recentActivity.map(a => `
        <div style="padding: 8px 0; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between;">
          <span>${a.project_name || 'Unknown'}: ${a.action}</span>
          <span style="color: ${a.status === 'success' || a.status === 'completed' ? 'var(--success)' : a.status === 'failed' ? 'var(--error)' : 'var(--text-secondary)'};">${a.status}</span>
        </div>
      `).join('');
    }

    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = '<p style="color: var(--error);">Failed to load activity</p>';
  }
}

function renderRecentProjects(projects) {
  const container = document.getElementById('recent-projects');

  if (!projects || projects.length === 0) {
    container.innerHTML = '<div class="empty-state"><h3>No projects yet</h3><p>Click "Trigger Build" to create your first project</p></div>';
    return;
  }

  container.innerHTML = projects.map(p => `
    <div class="project-card" onclick="showProjectDetails('${p.id}')">
      <div class="project-info">
        <h3>${p.name}</h3>
        <p>${p.description || 'No description'}</p>
      </div>
      <span class="project-status status-${p.status}">${p.status}</span>
    </div>
  `).join('');
}

function renderApiUsage(usage) {
  const container = document.getElementById('api-usage');

  if (!usage || usage.length === 0) {
    container.innerHTML = '<p>No API usage recorded yet</p>';
    return;
  }

  container.innerHTML = usage.map(u => `
    <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border);">
      <span>${u.model}</span>
      <span>${u.total_tokens.toLocaleString()} tokens</span>
    </div>
  `).join('');
}

function renderErrors(errors) {
  const container = document.getElementById('error-list');

  if (!errors || errors.length === 0) {
    container.innerHTML = '<p>No errors recorded</p>';
    return;
  }

  container.innerHTML = errors.map(e => `
    <div class="error-item">
      <p>${e.error_message}</p>
      <span>Occurred ${e.count} time(s)</span>
    </div>
  `).join('');
}

async function loadProjects() {
  const container = document.getElementById('projects-list');
  container.innerHTML = '<div class="loading">Loading projects...</div>';

  try {
    const projects = await fetchAPI('/api/projects');

    if (projects.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No projects</h3><p>Click "Trigger Build" to create your first project</p></div>';
      return;
    }

    container.innerHTML = projects.map(p => `
      <div class="project-card" onclick="showProjectDetails('${p.id}')">
        <div class="project-info">
          <h3>${p.name}</h3>
          <p>${p.description || 'No description'}</p>
          ${p.repo_url ? '<a href="' + p.repo_url + '" target="_blank" style="color: var(--accent); font-size: 0.85rem;">View on GitHub</a>' : ''}
        </div>
        <span class="project-status status-${p.status}">${p.status}</span>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = '<div class="error-state">Failed to load projects</div>';
  }
}

async function loadConfig() {
  try {
    const config = await fetchAPI('/api/config');

    document.getElementById('github-username').value = config.githubUsername || '';
    document.getElementById('selected-model').value = config.selectedModel || 'big-pickle';
    document.getElementById('schedule-enabled').checked = config.scheduleEnabled;
    document.getElementById('max-projects').value = config.maxProjectsPerDay;
    document.getElementById('require-tests').checked = config.requireTests;
    document.getElementById('auto-merge').checked = config.autoMergeToMain;
  } catch (error) {
    console.error('Failed to load config:', error);
  }
}

async function saveConfig(e) {
  e.preventDefault();

  const config = {
    githubUsername: document.getElementById('github-username').value,
    selectedModel: document.getElementById('selected-model').value,
    scheduleEnabled: document.getElementById('schedule-enabled').checked,
    maxProjectsPerDay: parseInt(document.getElementById('max-projects').value),
    requireTests: document.getElementById('require-tests').checked,
    autoMergeToMain: document.getElementById('auto-merge').checked
  };

  try {
    await fetchAPI('/api/config', { method: 'PUT', body: config });
    alert('Configuration saved!');
  } catch (error) {
    alert('Failed to save configuration');
  }
}

async function loadModels() {
  const container = document.getElementById('models-list');
  container.innerHTML = '<div class="loading">Loading models from OpenCode Zen...</div>';

  try {
    const result = await fetchAPI('/api/models');
    const models = result.models || [];
    const error = result.error;
    const source = result.source || 'unknown';

    if (error) {
      container.innerHTML = '<div class="error-item"><p>Failed to load models: ' + error + '</p><span>Source: ' + source + '</span></div>';
      return;
    }

    if (models.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No free models found</h3><p>Source: ' + source + ' | Try "Clear Cache & Refresh"</p></div>';
      return;
    }

    container.innerHTML = '<p style="color: var(--text-secondary); margin-bottom: 15px;">Source: ' + source + ' | ' + models.length + ' free models found</p>' +
      models.map(m => `
      <div class="model-card">
        <h3>${m.name}</h3>
        <p>Provider: ${m.provider}</p>
        <p>ID: <code>${m.id}</code></p>
        ${m.isFree ? '<span class="badge badge-free">Free</span>' : ''}
        <button class="btn btn-secondary" style="margin-top: 10px;" onclick="testModel('${m.id}')">Test</button>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = '<div class="error-item"><p>Network error: ' + error.message + '</p></div>';
  }
}

async function clearModelsCache() {
  const container = document.getElementById('models-list');
  container.innerHTML = '<div class="loading">Clearing cache and refreshing...</div>';

  try {
    await fetchAPI('/api/models/clear-cache', { method: 'POST' });
    await loadModels();
  } catch (error) {
    container.innerHTML = '<div class="error-item"><p>Failed to clear cache: ' + error.message + '</p></div>';
  }
}

async function testModel(modelId) {
  try {
    const result = await fetchAPI('/api/models/test', {
      method: 'POST',
      body: { model: modelId }
    });

    if (result.success) {
      var info = 'Response: ' + result.response;
      if (result.model) info += '\nModel: ' + result.model;
      if (result.cost !== undefined) info += '\nCost: $' + result.cost;
      if (result.tokens) info += '\nTokens: ' + result.tokens;
      alert(info);
    } else {
      alert('Test failed: ' + result.error);
    }
  } catch (error) {
    alert('Failed to test model');
  }
}

function showNewProjectModal() {
  const modal = document.getElementById('modal');
  const body = document.getElementById('modal-body');

  body.innerHTML = `
    <h2>Create New Project</h2>
    <form id="new-project-form">
      <div class="form-group">
        <label for="project-name">Project Name</label>
        <input type="text" id="project-name" required>
      </div>
      <div class="form-group">
        <label for="project-type">Project Type</label>
        <select id="project-type">
          <option value="webapp">Web Application</option>
          <option value="cli">CLI Tool</option>
          <option value="library">Library</option>
          <option value="api">API</option>
          <option value="tool">Utility Tool</option>
        </select>
      </div>
      <div class="form-group">
        <label for="project-desc">Description</label>
        <input type="text" id="project-desc">
      </div>
      <button type="submit" class="btn btn-primary">Create Project</button>
    </form>
  `;

  document.getElementById('new-project-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const project = {
      name: document.getElementById('project-name').value,
      type: document.getElementById('project-type').value,
      description: document.getElementById('project-desc').value
    };

    try {
      await fetchAPI('/api/projects', { method: 'POST', body: project });
      modal.classList.add('hidden');
      loadProjects();
      loadOverview();
    } catch (error) {
      alert('Failed to create project');
    }
  });

  modal.classList.remove('hidden');
}

async function triggerBuild() {
  const btn = document.getElementById('btn-trigger-build');
  btn.disabled = true;
  btn.textContent = 'Starting...';

  try {
    const result = await fetchAPI('/api/trigger', { method: 'POST' });
    alert('Build started! Project: ' + result.project.name + '\nID: ' + result.projectId);
    loadOverview();
    loadActivity();
  } catch (error) {
    alert('Failed to trigger build: ' + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Trigger Build';
  }
}

async function showProjectDetails(id) {
  try {
    const project = await fetchAPI('/api/projects/' + id);
    const files = await fetchAPI('/api/projects/' + id + '/files');
    const modal = document.getElementById('modal');
    const body = document.getElementById('modal-body');

    let filesHtml = '';
    if (files && files.length > 0) {
      filesHtml = '<h3 style="margin-top: 20px;">Generated Files</h3>';
      filesHtml += '<div style="max-height: 300px; overflow-y: auto; background: var(--bg-primary); padding: 10px; border-radius: 5px; margin-top: 10px;">';
      filesHtml += files.map(f => `
        <div style="padding: 5px 0; border-bottom: 1px solid var(--border); cursor: pointer;" onclick="toggleFileContent(this)">
          <strong>' + f.file_path + '</strong>
          <pre style="display: none; margin-top: 5px; padding: 10px; background: var(--bg-card); border-radius: 3px; overflow-x: auto; font-size: 0.85rem;">' + escapeHtml(f.content || '') + '</pre>
        </div>
      `).join('');
      filesHtml += '</div>';
    }

    let historyHtml = '';
    if (project.history && project.history.length > 0) {
      historyHtml = '<h3 style="margin-top: 20px;">Build History</h3>';
      historyHtml += '<div style="max-height: 200px; overflow-y: auto;">';
      historyHtml += project.history.map(h => `
        <div style="padding: 8px 0; border-bottom: 1px solid var(--border);">
          <span style="color: ' + (h.status === 'completed' || h.status === 'success' ? 'var(--success)' : h.status === 'failed' ? 'var(--error)' : 'var(--warning)') + ';">
            ' + h.action + '
          </span>
          ' + (h.details ? ' - ' + h.details : '') + '
        </div>
      `).join('');
      historyHtml += '</div>';
    }

    body.innerHTML = `
      <h2>' + project.name + '</h2>
      <p><strong>Status:</strong> <span class="project-status status-' + project.status + '">' + project.status + '</span></p>
      <p><strong>Type:</strong> ' + project.type + '</p>
      <p><strong>Description:</strong> ' + (project.description || 'N/A') + '</p>
      <p><strong>Created:</strong> ' + project.created_at + '</p>
      ' + (project.repo_url ? '<p><strong>Repository:</strong> <a href="' + project.repo_url + '" target="_blank">' + project.repo_url + '</a></p>' : '')
      + (project.error_message ? '<p style="color: var(--error);"><strong>Error:</strong> ' + project.error_message + '</p>' : '')
      + filesHtml
      + historyHtml
      + '<div style="margin-top: 20px; display: flex; gap: 10px;">'
      + '<button class="btn btn-secondary" onclick="deleteProject(\'' + project.id + '\')">Delete</button>'
      + '<button class="btn btn-primary" onclick="document.getElementById(\'modal\').classList.add(\'hidden\')">Close</button>'
      + '</div>
    `;

    modal.classList.remove('hidden');
  } catch (error) {
    alert('Failed to load project details: ' + error.message);
  }
}

function toggleFileContent(el) {
  const pre = el.querySelector('pre');
  if (pre) {
    pre.style.display = pre.style.display === 'none' ? 'block' : 'none';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function deleteProject(id) {
  if (!confirm('Are you sure you want to delete this project?')) return;

  try {
    await fetchAPI('/api/projects/' + id, { method: 'DELETE' });
    document.getElementById('modal').classList.add('hidden');
    loadProjects();
    loadOverview();
  } catch (error) {
    alert('Failed to delete project');
  }
}

async function fetchAPI(url, options = {}) {
  const response = await fetch(API_BASE + url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    throw new Error('API error: ' + response.statusText);
  }

  if (response.status === 204) return null;
  return response.json();
}
