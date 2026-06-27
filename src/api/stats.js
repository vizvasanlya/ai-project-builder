export async function getStats(db) {
  const totalProjects = await db.prepare('SELECT COUNT(*) as count FROM projects').first();
  const completedProjects = await db.prepare("SELECT COUNT(*) as count FROM projects WHERE status = 'completed'").first();
  const failedProjects = await db.prepare("SELECT COUNT(*) as count FROM projects WHERE status = 'failed'").first();
  const pendingProjects = await db.prepare("SELECT COUNT(*) as count FROM projects WHERE status IN ('pending', 'researching', 'generating', 'testing')").first();
  
  const recentProjects = await db.prepare('SELECT * FROM projects ORDER BY created_at DESC LIMIT 10').all();
  
  const apiUsage = await db.prepare(`
    SELECT model, SUM(tokens_used) as total_tokens, SUM(request_count) as total_requests
    FROM api_usage
    WHERE date >= date('now', '-7 days')
    GROUP BY model
  `).all();
  
  const errors = await db.prepare(`
    SELECT error_message, COUNT(*) as count
    FROM projects
    WHERE status = 'failed' AND error_message IS NOT NULL
    GROUP BY error_message
    ORDER BY count DESC
    LIMIT 5
  `).all();

  return {
    total: totalProjects?.count || 0,
    completed: completedProjects?.count || 0,
    failed: failedProjects?.count || 0,
    pending: pendingProjects?.count || 0,
    recentProjects: recentProjects.results,
    apiUsage: apiUsage.results,
    topErrors: errors.results
  };
}
