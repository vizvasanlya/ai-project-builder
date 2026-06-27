export async function pushToGitHub(env, project, code, config) {
  const repoName = `ai-${project.name}-${Date.now()}`;
  const headers = {
    'Authorization': `token ${env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  };

  const repo = await createRepo(env, repoName, project, headers);
  
  await createBranch(env, repoName, 'develop', headers);
  
  for (const file of code.files) {
    await createOrUpdateFile(env, repoName, file, 'develop', headers);
  }

  await createPullRequest(env, repoName, project, headers);

  if (config.autoMergeToMain) {
    await mergePullRequest(env, repoName, headers);
  }

  return {
    name: repoName,
    url: `https://github.com/${config.githubUsername}/${repoName}`
  };
}

async function createRepo(env, repoName, project, headers) {
  const response = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: repoName,
      description: project.description,
      auto_init: false,
      private: false
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create repo: ${error.message}`);
  }

  return response.json();
}

async function createBranch(env, repoName, branch, headers) {
  const mainRef = await fetch(`https://api.github.com/repos/${env.GITHUB_USERNAME}/${repoName}/git/ref/heads/main`, { headers });
  const mainData = await mainRef.json();
  
  await fetch(`https://api.github.com/repos/${env.GITHUB_USERNAME}/${repoName}/git/refs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ref: `refs/heads/${branch}`,
      sha: mainData.object.sha
    })
  });
}

async function createOrUpdateFile(env, repoName, file, branch, headers) {
  const content = btoa(unescape(encodeURIComponent(file.content)));
  
  let sha = null;
  try {
    const existing = await fetch(
      `https://api.github.com/repos/${env.GITHUB_USERNAME}/${repoName}/contents/${file.path}?ref=${branch}`,
      { headers }
    );
    if (existing.ok) {
      const data = await existing.json();
      sha = data.sha;
    }
  } catch (e) {}

  const body = {
    message: `Add ${file.path}`,
    content,
    branch
  };
  
  if (sha) {
    body.sha = sha;
  }

  await fetch(`https://api.github.com/repos/${env.GITHUB_USERNAME}/${repoName}/contents/${file.path}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body)
  });
}

async function createPullRequest(env, repoName, project, headers) {
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_USERNAME}/${repoName}/pulls`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: `feat: Initial ${project.name} implementation`,
      body: `## Changes\n\n- Initial project structure\n- Core implementation\n- Tests\n- Documentation`,
      head: 'develop',
      base: 'main'
    })
  });

  return response.json();
}

async function mergePullRequest(env, repoName, headers) {
  const pulls = await fetch(`https://api.github.com/repos/${env.GITHUB_USERNAME}/${repoName}/pulls?state=open`, { headers });
  const pullsData = await pulls.json();
  
  if (pullsData.length > 0) {
    await fetch(`https://api.github.com/repos/${env.GITHUB_USERNAME}/${repoName}/pulls/${pullsData[0].number}/merge`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        merge_method: 'squash'
      })
    });
  }
}
