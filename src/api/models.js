export async function getModels(env) {
  const cached = await env.KV.get('models', { type: 'json' });
  if (cached && Date.now() - cached.fetchedAt < 3600000) {
    return cached.models;
  }

  try {
    const response = await fetch('https://api.opencode.ai/v1/models');
    const data = await response.json();
    
    const allModels = data.data || data.models || [];
    
    const freeModels = allModels
      .filter(function(m) {
        var pricing = m.pricing || m.price || {};
        var promptPrice = pricing.prompt || pricing.input || pricing.inputPrice || '';
        return promptPrice === '0' || promptPrice === 0 || promptPrice === 'Free' || promptPrice === 'free';
      })
      .map(function(m) {
        return {
          id: m.id,
          name: m.name || m.id,
          provider: m.owned_by || m.provider || 'unknown',
          maxTokens: m.context_length || m.maxTokens || 4096,
          isFree: true
        };
      });

    if (freeModels.length === 0) {
      return getDefaultModels();
    }

    await env.KV.put('models', JSON.stringify({
      models: freeModels,
      fetchedAt: Date.now()
    }));

    return freeModels;
  } catch (error) {
    console.error('Failed to fetch models:', error);
    return getDefaultModels();
  }
}

export async function testModel(env, modelId) {
  try {
    const response = await fetch('https://api.opencode.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + env.OPENCODE_ZEN_API_KEY
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'Say "test successful"' }],
        max_tokens: 10
      })
    });

    if (!response.ok) {
      var error = await response.json();
      return { success: false, error: error.error?.message || 'API error' };
    }

    var data = await response.json();
    return { success: true, response: data.choices[0].message.content };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function getDefaultModels() {
  return [
    { id: 'big-pickle', name: 'Big Pickle', provider: 'opencode', maxTokens: 4096, isFree: true },
    { id: 'deepseek-v4-flash-free', name: 'DeepSeek V4 Flash Free', provider: 'deepseek', maxTokens: 4096, isFree: true },
    { id: 'mimo-v2.5-free', name: 'MiMo-V2.5 Free', provider: 'xiaomi', maxTokens: 4096, isFree: true },
    { id: 'north-mini-code-free', name: 'North Mini Code Free', provider: 'opencode', maxTokens: 4096, isFree: true },
    { id: 'nemotron-3-ultra-free', name: 'Nemotron 3 Ultra Free', provider: 'nvidia', maxTokens: 4096, isFree: true }
  ];
}
