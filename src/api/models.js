export async function getModels(env) {
  var cached = await env.KV.get('models', { type: 'json' });
  
  if (cached && cached.models && cached.models.length > 0 && Date.now() - cached.fetchedAt < 86400000) {
    return { models: cached.models, error: null, source: 'cache' };
  }

  try {
    var response = await fetch('https://opencode.ai/zen/v1/models');
    
    if (!response.ok) {
      throw new Error('API returned status ' + response.status);
    }
    
    var data = await response.json();
    var allModels = data.data || [];
    
    var freeModels = [];
    
    for (var i = 0; i < allModels.length; i++) {
      var m = allModels[i];
      var id = m.id || '';
      var isFree = id.indexOf('-free') !== -1 || id === 'big-pickle';
      
      if (isFree) {
        freeModels.push({
          id: id,
          name: formatModelName(id),
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

    return { models: freeModels, error: null, source: 'api' };
  } catch (error) {
    console.error('Failed to fetch models:', error.message);
    
    if (cached && cached.models && cached.models.length > 0) {
      return { models: cached.models, error: null, source: 'stale-cache' };
    }
    
    return { models: [], error: error.message, source: 'error' };
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

export async function clearModelsCache(env) {
  await env.KV.delete('models');
  return { success: true };
}

export async function testModel(env, modelId) {
  try {
    var apiKey = env.OPENCODE_ZEN_API_KEY;
    
    if (!apiKey) {
      return { success: false, error: 'OPENCODE_ZEN_API_KEY not configured' };
    }

    var response = await fetch('https://opencode.ai/zen/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'HTTP-Referer': 'https://github.com/vizvasanlya/ai-project-builder',
        'X-Title': 'AI Project Builder'
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 5
      })
    });

    var responseText = await response.text();
    
    if (!response.ok) {
      var errorMsg = 'HTTP ' + response.status;
      try {
        var errorJson = JSON.parse(responseText);
        errorMsg = errorJson.error?.message || errorJson.message || responseText.substring(0, 200);
      } catch (e) {
        errorMsg = responseText.substring(0, 200);
      }
      
      if (response.status === 429) {
        return { 
          success: false, 
          error: 'Rate limited. Free APIs often block Cloudflare Worker IPs. Try: (1) Wait and retry, (2) Run locally with npm run dev, (3) Use a paid API key.',
          status: 429,
          isRateLimit: true
        };
      }
      
      return { success: false, error: errorMsg, status: response.status };
    }

    var data = JSON.parse(responseText);
    var content = '';
    
    if (data.choices && data.choices[0]) {
      content = data.choices[0].message?.content || '';
      if (!content && data.choices[0].message?.reasoning_content) {
        content = '(reasoning only)';
      }
    }
    
    return { 
      success: true, 
      response: content || '(empty)',
      model: data.model,
      cost: data.cost || '0',
      tokens: data.usage?.total_tokens || 0
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
