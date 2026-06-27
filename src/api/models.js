export async function getModels(env) {
  var cached = await env.KV.get('models', { type: 'json' });
  
  if (cached && Date.now() - cached.fetchedAt < 86400000) {
    return { models: cached.models, error: null };
  }

  try {
    var response = await fetch('https://opencode.ai/zen/v1/models');
    
    if (!response.ok) {
      throw new Error('API returned status ' + response.status);
    }
    
    var data = await response.json();
    var allModels = data.data || data.models || [];
    
    var freeModelIds = [
      'big-pickle',
      'deepseek-v4-flash-free',
      'mimo-v2.5-free',
      'north-mini-code-free',
      'nemotron-3-ultra-free',
      'qwen3.6-plus-free',
      'minimax-m3-free'
    ];
    
    var freeModels = [];
    
    for (var i = 0; i < allModels.length; i++) {
      var m = allModels[i];
      var isFree = freeModelIds.indexOf(m.id) !== -1 || 
                   m.id.indexOf('-free') !== -1;
      
      if (isFree) {
        freeModels.push({
          id: m.id,
          name: formatModelName(m.id),
          provider: m.owned_by || 'opencode',
          isFree: true
        });
      }
    }

    await env.KV.put('models', JSON.stringify({
      models: freeModels,
      fetchedAt: Date.now(),
      totalModels: allModels.length
    }));

    return { models: freeModels, error: null };
  } catch (error) {
    console.error('Failed to fetch models:', error.message);
    
    if (cached && cached.models) {
      return { models: cached.models, error: null };
    }
    
    return { models: [], error: error.message };
  }
}

function formatModelName(id) {
  var names = {
    'big-pickle': 'Big Pickle',
    'deepseek-v4-flash-free': 'DeepSeek V4 Flash Free',
    'mimo-v2.5-free': 'MiMo-V2.5 Free',
    'north-mini-code-free': 'North Mini Code Free',
    'nemotron-3-ultra-free': 'Nemotron 3 Ultra Free',
    'qwen3.6-plus-free': 'Qwen3.6 Plus Free',
    'minimax-m3-free': 'MiniMax M3 Free'
  };
  
  if (names[id]) return names[id];
  
  return id.split('-').map(function(w) {
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
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
      var errorText = await response.text();
      try {
        var errorJson = JSON.parse(errorText);
        return { success: false, error: errorJson.error?.message || errorText };
      } catch (e) {
        return { success: false, error: errorText };
      }
    }

    var data = await response.json();
    return { success: true, response: data.choices[0].message.content };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
