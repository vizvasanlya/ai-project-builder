export async function getModels(env) {
  const cached = await env.KV.get('models', { type: 'json' });
  if (cached && Date.now() - cached.fetchedAt < 3600000) {
    return cached.models;
  }

  try {
    const response = await fetch('https://api.opencode.ai/v1/models');
    const data = await response.json();
    
    const freeModels = data.models
      .filter(m => m.pricing && m.pricing.prompt === '0')
      .map(m => ({
        id: m.id,
        name: m.name,
        provider: m.owned_by,
        maxTokens: m.context_length,
        isFree: true
      }));

    await env.KV.put('models', JSON.stringify({
      models: freeModels,
      fetchedAt: Date.now()
    }));

    return freeModels;
  } catch (error) {
    return getDefaultModels();
  }
}

export async function testModel(env, modelId) {
  try {
    const response = await fetch('https://api.opencode.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENCODE_ZEN_API_KEY}`
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'Say "test successful"' }],
        max_tokens: 10
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error?.message || 'API error' };
    }

    const data = await response.json();
    return { success: true, response: data.choices[0].message.content };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function getDefaultModels() {
  return [
    { id: 'gpt-4', name: 'GPT-4', provider: 'openai', maxTokens: 8192, isFree: false },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', maxTokens: 4096, isFree: false },
    { id: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'anthropic', maxTokens: 200000, isFree: false }
  ];
}
