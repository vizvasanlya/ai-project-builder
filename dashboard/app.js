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
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
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
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
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
      container.innerHTML = '<div class="empty-state" style="padding: 40px 20px;"><p>No activity yet</p></div>';
      return;
    }

    let html = '';

    if (data.activeProjects.length > 0) {
      data.activeProjects.forEach(p => {
        html += '<div class="activity-item">' +
          '<div class="activity-dot running"></div>' +
          '<div class="activity-content">' +
            '<div class="activity-title">' + p.name + '</div>' +
            '<div class="activity-subtitle">' + p.type + ' - ' + p.status + '</div>' +
          '</div>' +
          '<div class="activity-time">running</div>' +
        '</div>';
      });
    }

    data.recentActivity.slice(0, 8).forEach(a => {
      var dotClass = a.status === 'success' || a.status === 'completed' ? 'success' :
                     a.status === 'failed' ? 'failed' : 'info';
      html += '<div class="activity-item">' +
        '<div class="activity-dot ' + dotClass + '"></div>' +
        '<div class="activity-content">' +
          '<div class="activity-title">' + (a.project_name || 'System') + '</div>' +
          '<div class="activity-subtitle">' + a.action + '</div>' +
        '</div>' +
        '<div class="activity-time">' + formatTime(a.created_at) + '</div>' +
      '</div>';
    });

    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = '<div class="empty-state" style="padding: 40px 20px;"><p>Failed to load activity</p></div>';
  }
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr);
  var now = new Date();
  var diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

function renderRecentProjects(projects) {
  const container = document.getElementById('recent-projects');

  if (!projects || projects.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">*</div><h3>No projects yet</h3><p>Click "Trigger Build" to create one</p></div>';
    return;
  }

  container.innerHTML = projects.map(p => `
    <div class="project-card" onclick="showProjectDetails('${p.id}')">
      <div class="project-info">
        <h3>${p.name}</h3>
        <p>${p.description || 'No description'}</p>
      </div>
      <div class="project-meta">
        ${p.repo_url ? '<a href="' + p.repo_url + '" target="_blank" class="project-link" onclick="event.stopPropagation()">GitHub</a>' : ''}
        <span class="status-badge status-${p.status}">${p.status}</span>
      </div>
    </div>
  `).join('');
}

function renderApiUsage(usage) {
  const container = document.getElementById('api-usage');

  if (!usage || usage.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding: 40px 20px;"><p>No API usage yet</p></div>';
    return;
  }

  container.innerHTML = usage.map(u => `
    <div class="activity-item">
      <div class="activity-dot info"></div>
      <div class="activity-content">
        <div class="activity-title">${u.model}</div>
        <div class="activity-subtitle">${u.total_tokens.toLocaleString()} tokens</div>
      </div>
    </div>
  `).join('');
}

function renderErrors(errors) {
  const container = document.getElementById('error-list');

  if (!errors || errors.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding: 40px 20px;"><p>No errors recorded</p></div>';
    return;
  }

  container.innerHTML = errors.map(e => `
    <div class="error-item">
      <div class="error-icon">!</div>
      <div class="error-content">
        <div class="error-message">${e.error_message}</div>
        <div class="error-count">Occurred ${e.count} time(s)</div>
      </div>
    </div>
  `).join('');
}

async function loadProjects() {
  const container = document.getElementById('projects-list');
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div> Loading projects...</div>';

  try {
    const projects = await fetchAPI('/api/projects');

    if (projects.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">*</div><h3>No projects</h3><p>Create your first project to get started</p></div>';
      return;
    }

    container.innerHTML = projects.map(p => `
      <div class="project-card" onclick="showProjectDetails('${p.id}')">
        <div class="project-info">
          <h3>${p.name}</h3>
          <p>${p.description || 'No description'}</p>
        </div>
        <div class="project-meta">
          ${p.repo_url ? '<a href="' + p.repo_url + '" target="_blank" class="project-link" onclick="event.stopPropagation()">GitHub</a>' : ''}
          <span class="status-badge status-${p.status}">${p.status}</span>
        </div>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = '<div class="empty-state"><p>Failed to load projects</p></div>';
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
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div> Loading models...</div>';

  try {
    const result = await fetchAPI('/api/models');
    const models = result.models || [];
    const error = result.error;
    const source = result.source || 'unknown';

    if (error) {
      container.innerHTML = '<div class="error-item"><div class="error-icon">!</div><div class="error-content"><div class="error-message">' + error + '</div><div class="error-count">Source: ' + source + '</div></div></div>';
      return;
    }

    if (models.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">*</div><h3>No free models found</h3><p>Source: ' + source + ' - Try clearing cache</p></div>';
      return;
    }

    container.innerHTML = models.map(m => `
      <div class="model-card">
        <div class="model-header">
          <div class="model-name">${m.name}</div>
          ${m.isFree ? '<span class="model-badge free">Free</span>' : ''}
        </div>
        <div class="model-details">
          <div class="model-detail">Provider: ${m.provider}</div>
          <div class="model-detail">ID: <code>${m.id}</code></div>
        </div>
        <div class="model-actions">
          <button class="btn btn-secondary btn-sm" onclick="testModel('${m.id}')">Test</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    container.innerHTML = '<div class="error-item"><div class="error-icon">!</div><div class="error-content"><div class="error-message">' + error.message + '</div></div></div>';
  }
}

async function clearModelsCache() {
  const container = document.getElementById('models-list');
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div> Clearing cache...</div>';

  try {
    await fetchAPI('/api/models/clear-cache', { method: 'POST' });
    await loadModels();
  } catch (error) {
    container.innerHTML = '<div class="error-item"><div class="error-icon">!</div><div class="error-content"><div class="error-message">' + error.message + '</div></div></div>';
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
  var modal = document.getElementById('modal');
  var title = document.getElementById('modal-title');
  var body = document.getElementById('modal-body');

  title.textContent = 'Create New Project';
  body.innerHTML = `
    <form id="new-project-form">
      <div class="form-grid">
        <div class="form-group full-width">
          <label class="form-label">Project Name</label>
          <input type="text" id="project-name" class="form-input" required placeholder="my-awesome-project">
        </div>
        <div class="form-group">
          <label class="form-label">Project Type</label>
          <select id="project-type" class="form-select">
            <option value="webapp">Web Application</option>
            <option value="cli">CLI Tool</option>
            <option value="library">Library</option>
            <option value="api">API</option>
            <option value="tool">Utility Tool</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <input type="text" id="project-desc" class="form-input" placeholder="Brief description">
        </div>
      </div>
      <div style="margin-top: 24px; display: flex; justify-content: flex-end; gap: 12px;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Create Project</button>
      </div>
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
      closeModal();
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
  btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;"></div> Starting...';

  try {
    const result = await fetchAPI('/api/trigger', { method: 'POST' });
    alert('Build started!\nProject: ' + result.project.name + '\nType: ' + result.project.type);
    loadOverview();
    loadActivity();
  } catch (error) {
    alert('Failed to trigger build: ' + error.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>+</span> Trigger Build';
  }
}

async function showProjectDetails(id) {
  try {
    const project = await fetchAPI('/api/projects/' + id);
    const files = await fetchAPI('/api/projects/' + id + '/files');
    var modal = document.getElementById('modal');
    var title = document.getElementById('modal-title');
    var body = document.getElementById('modal-body');

    title.textContent = project.name;

    var html = '<div style="display: flex; flex-direction: column; gap: 16px;">';

    html += '<div style="display: flex; gap: 12px; flex-wrap: wrap;">';
    html += '<span class="status-badge status-' + project.status + '">' + project.status + '</span>';
    html += '<span style="color: var(--text-secondary); font-size: 0.85rem;">Type: ' + project.type + '</span>';
    html += '<span style="color: var(--text-secondary); font-size: 0.85rem;">Created: ' + project.created_at + '</span>';
    html += '</div>';

    if (project.description) {
      html += '<p style="color: var(--text-secondary);">' + project.description + '</p>';
    }

    if (project.repo_url) {
      html += '<a href="' + project.repo_url + '" target="_blank" class="project-link" style="width: fit-content;">View on GitHub</a>';
    }

    if (project.error_message) {
      html += '<div class="error-item"><div class="error-icon">!</div><div class="error-content"><div class="error-message">' + project.error_message + '</div></div></div>';
    }

    if (files && files.length > 0) {
      html += '<div style="margin-top: 8px;">';
      html += '<div class="toggle-header" onclick="toggleFiles(this)">';
      html += '<span style="font-weight: 500;">Generated Files (' + files.length + ')</span>';
      html += '<span class="toggle-icon">v</span>';
      html += '</div>';
      html += '<div class="toggle-content">';
      files.forEach(f => {
        html += '<div style="margin-bottom: 12px;">';
        html += '<div class="toggle-header" onclick="toggleFile(this)" style="margin-bottom: 4px;">';
        html += '<span style="font-size: 0.85rem; font-family: monospace;">' + f.file_path + '</span>';
        html += '<span class="toggle-icon">v</span>';
        html += '</div>';
        html += '<div class="toggle-content"><pre class="code-block">' + escapeHtml(f.content || '') + '</pre></div>';
        html += '</div>';
      });
      html += '</div></div>';
    }

    if (project.history && project.history.length > 0) {
      html += '<div style="margin-top: 8px;">';
      html += '<div class="toggle-header" onclick="toggleFiles(this)">';
      html += '<span style="font-weight: 500;">Build History (' + project.history.length + ')</span>';
      html += '<span class="toggle-icon">v</span>';
      html += '</div>';
      html += '<div class="toggle-content">';
      project.history.forEach(h => {
        var dotClass = h.status === 'success' || h.status === 'completed' ? 'success' :
                       h.status === 'failed' ? 'failed' : 'info';
        html += '<div class="activity-item">';
        html += '<div class="activity-dot ' + dotClass + '"></div>';
        html += '<div class="activity-content">';
        html += '<div class="activity-title">' + h.action + '</div>';
        html += (h.details ? '<div class="activity-subtitle">' + h.details + '</div>' : '');
        html += '</div>';
        html += '<div class="activity-time">' + formatTime(h.created_at) + '</div>';
        html += '</div>';
      });
      html += '</div></div>';
    }

    html += '<div style="margin-top: 16px; display: flex; gap: 12px;">';
    if (project.status === 'failed') {
      html += '<button class="btn btn-primary btn-sm" onclick="retryProject(\'' + project.id + '\')">Retry</button>';
    }
    html += '<button class="btn btn-danger btn-sm" onclick="deleteProject(\'' + project.id + '\')">Delete</button>';
    html += '<button class="btn btn-secondary btn-sm" onclick="closeModal()">Close</button>';
    html += '</div>';

    html += '</div>';

    body.innerHTML = html;
    modal.classList.remove('hidden');
  } catch (error) {
    alert('Failed to load project details');
  }
}

function toggleFiles(el) {
  var content = el.nextElementSibling;
  if (content) {
    content.classList.toggle('expanded');
    el.classList.toggle('expanded');
  }
}

function toggleFile(el) {
  var content = el.nextElementSibling;
  if (content) {
    content.classList.toggle('expanded');
    el.classList.toggle('expanded');
  }
}

function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function deleteProject(id) {
  if (!confirm('Are you sure you want to delete this project?')) return;

  try {
    await fetchAPI('/api/projects/' + id, { method: 'DELETE' });
    closeModal();
    loadProjects();
    loadOverview();
  } catch (error) {
    alert('Failed to delete project');
  }
}

async function retryProject(id) {
  try {
    await fetchAPI('/api/projects/retry', { method: 'POST', body: { projectId: id } });
    closeModal();
    loadProjects();
    loadOverview();
    alert('Project queued for retry');
  } catch (error) {
    alert('Failed to retry project');
  }
}

async function cleanupStuckProjects() {
  if (!confirm('Mark all stuck projects (>2 hours) as failed?')) return;

  try {
    var result = await fetchAPI('/api/projects/cleanup', { method: 'POST' });
    alert('Cleaned up ' + result.cleaned + ' stuck projects');
    loadProjects();
    loadOverview();
  } catch (error) {
    alert('Failed to cleanup');
  }
}

async function fetchAPI(url, options = {}) {
  var response = await fetch(API_BASE + url, {
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
