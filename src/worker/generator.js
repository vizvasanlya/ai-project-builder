export async function generateProject(env, project, research, config) {
  const prompt = buildPrompt(project, research);
  
  const response = await fetch('https://opencode.ai/zen/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + env.OPENCODE_ZEN_API_KEY
    },
    body: JSON.stringify({
      model: config.selectedModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4000
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'API request failed');
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  return parseGeneratedCode(content, project);
}

function buildPrompt(project, research) {
  const reqs = research.requirements.map(function(r) { return '- ' + r; }).join('\n');
  
  return 'Generate a production-ready ' + project.type + ' called "' + project.name + '".\n\n' +
    'Description: ' + project.description + '\n\n' +
    'Requirements:\n' + reqs + '\n\n' +
    'Tech Stack: ' + research.techStack.join(', ') + '\n\n' +
    'Return the code as a JSON object with files array.\n' +
    'Make sure all code is syntactically valid and includes tests.';
}

function parseGeneratedCode(content, project) {
  try {
    var jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    var parsed = JSON.parse(jsonMatch[0]);
    
    if (!parsed.files || !Array.isArray(parsed.files)) {
      throw new Error('Invalid response structure');
    }
    
    return {
      name: parsed.name || project.name,
      description: parsed.description || project.description,
      files: parsed.files.map(function(f) {
        return { path: f.path, content: f.content };
      })
    };
  } catch (error) {
    return getDefaultProject(project);
  }
}

function getDefaultProject(project) {
  var indexContent = '/**\n' +
    ' * ' + project.name + '\n' +
    ' * ' + project.description + '\n' +
    ' */\n\n' +
    'export function main() {\n' +
    '  console.log("Hello from ' + project.name + '");\n' +
    '}\n\n' +
    'export default main;';

  var readmeContent = '# ' + project.name + '\n\n' +
    project.description + '\n\n' +
    '## Installation\n\n' +
    '```bash\nnpm install ' + project.name + '\n```\n\n' +
    '## Usage\n\n' +
    '```javascript\nimport { main } from "' + project.name + '";\n\nmain();\n```\n\n' +
    '## License\n\nMIT';

  var testContent = "import { describe, it } from 'node:test';\n" +
    "import assert from 'node:assert';\n" +
    "import { main } from '../src/index.js';\n\n" +
    "describe('" + project.name + "', () => {\n" +
    "  it('should export main function', () => {\n" +
    "    assert(typeof main === 'function');\n" +
    "  });\n" +
    "});";

  var packageJson = JSON.stringify({
    name: project.name,
    version: '1.0.0',
    description: project.description,
    main: 'src/index.js',
    type: 'module',
    scripts: {
      test: 'node --test tests/',
      start: 'node src/index.js'
    },
    keywords: [project.type],
    license: 'MIT'
  }, null, 2);

  return {
    name: project.name,
    description: project.description,
    files: [
      { path: 'src/index.js', content: indexContent },
      { path: 'package.json', content: packageJson },
      { path: 'README.md', content: readmeContent },
      { path: 'tests/index.test.js', content: testContent }
    ]
  };
}
