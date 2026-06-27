export async function getModels(env) {
  var cached = await env.KV.get('models', { type: 'json' });
  
  if (cached && Date.now() - cached.fetchedAt < 86400000) {
    return cached.models;
  }

  try {
    var response = await fetch('https://opencode.ai/zen/v1/models');
    
    if (!response.ok) {
      throw new Error('Failed to fetch models');
    }
    
    var data = await response.json();
    var allModels = data.data || data.models || [];
    
    var freeModels = [];
    
    for (var i = 0; i < allModels.length; i++) {
      var m = allModels[i];
      var pricing = m.pricing || {};
      var inputPrice = pricing.prompt || pricing.input || '';
      
      if (inputPrice === 'Free' || inputPrice === 'free' || inputPrice === '0' || inputPrice === 0) {
        freeModels.push({
          id: m.id,
          name: m.name || m.id,
          provider: m.owned_by || m.provider || 'opencode',
          maxTokens: m.context_length || m.maxTokens || 4096,
          isFree: true,
          endpoint: m.endpoint || 'https://opencode.ai/zen/v1/chat/completions'
        });
      }
    }

    await env.KV.put('models', JSON.stringify({
      models: freeModels,
      fetchedAt: Date.now(),
      source: 'opencode-zen'
    }));

    return freeModels;
  } catch (error) {
    console.error('Failed to fetch models from OpenCode Zen:', error);
    
    var staleCached = await env.KV.get('models', { type: 'json' });
    if (staleCached && staleCached.models) {
      return staleCached.models;
    }
    
    return [];
  }
}

export async function testModel(env, modelId) {
  try {
    var response = await fetch('https://opencode.ai/zen/v1/chat/completions', {
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
