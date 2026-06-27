export async function getProjects(db) {
  const { results } = await db.prepare(`
    SELECT * FROM projects ORDER BY created_at DESC
  `).all();
  return results;
}

export async function getProject(db, id) {
  const project = await db.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first();
  if (!project) return null;
  
  const files = await db.prepare('SELECT * FROM project_files WHERE project_id = ?').bind(id).all();
  const history = await db.prepare('SELECT * FROM build_history WHERE project_id = ? ORDER BY created_at DESC').bind(id).all();
  
  return { ...project, files: files.results, history: history.results };
}

export async function createProject(db, data) {
  const id = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await db.prepare(`
    INSERT INTO projects (id, name, type, status, description)
    VALUES (?, ?, ?, 'pending', ?)
  `).bind(id, data.name, data.type, data.description || '').run();
  
  return await getProject(db, id);
}

export async function updateProject(db, id, data) {
  const fields = [];
  const values = [];
  
  for (const [key, value] of Object.entries(data)) {
    if (['status', 'description', 'repo_name', 'repo_url', 'branch', 'error_message'].includes(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }
  
  if (fields.length === 0) return await getProject(db, id);
  
  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  
  await db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  
  return await getProject(db, id);
}

export async function addProjectFile(db, projectId, filePath, content) {
  await db.prepare(`
    INSERT INTO project_files (project_id, file_path, content)
    VALUES (?, ?, ?)
  `).bind(projectId, filePath, content).run();
}

export async function addBuildHistory(db, projectId, action, status, details) {
  await db.prepare(`
    INSERT INTO build_history (project_id, action, status, details)
    VALUES (?, ?, ?, ?)
  `).bind(projectId, action, status, details || '').run();
}
