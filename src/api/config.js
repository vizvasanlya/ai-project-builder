const DEFAULT_CONFIG = {
  selectedModel: 'gpt-4',
  githubUsername: '',
  autoRetry: true,
  maxRetries: 3,
  projectTypes: ['webapp', 'cli', 'library', 'api', 'tool'],
  scheduleEnabled: true,
  scheduleInterval: 'hourly',
  workingHoursStart: 9,
  workingHoursEnd: 17,
  maxProjectsPerDay: 3,
  requireTests: true,
  autoMergeToMain: true
};

export async function getConfig(kv) {
  const stored = await kv.get('config', { type: 'json' });
  return { ...DEFAULT_CONFIG, ...stored };
}

export async function updateConfig(kv, updates) {
  const current = await getConfig(kv);
  const newConfig = { ...current, ...updates };
  await kv.put('config', JSON.stringify(newConfig));
  return newConfig;
}
