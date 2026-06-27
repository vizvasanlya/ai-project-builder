export async function generateProject(env, project, research, config) {
  const prompt = buildPrompt(project, research);
  
  const response = await fetch('https://api.opencode.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENCODE_ZEN_API_KEY}`
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
  return `Generate a production-ready ${project.type} called "${project.name}".

Description: ${project.description}

Requirements:
${research.requirements.map(r => `- ${r}`).join('\n')}

Tech Stack: ${research.techStack.join(', ')}

Return the code as a JSON object with this exact structure:
{
  "name": "project-name",
  "description": "Brief description",
  "files": [
    {
      "path": "src/index.js",
      "content": "file content here"
    },
    {
      "path": "package.json",
      "content": "{...}"
    },
    {
      "path": "README.md",
      "content": "# Project Name..."
    },
    {
      "path": "tests/index.test.js",
      "content": "test code"
    }
  ]
}

Make sure:
1. All code is syntactically valid
2. package.json is valid JSON
3. Tests use Node.js built-in test runner
4. README includes installation and usage instructions
5. Code follows best practices and has proper error handling`;
}

function parseGeneratedCode(content, project) {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    if (!parsed.files || !Array.isArray(parsed.files)) {
      throw new Error('Invalid response structure');
    }
    
    return {
      name: parsed.name || project.name,
      description: parsed.description || project.description,
      files: parsed.files.map(f => ({
        path: f.path,
        content: f.content
      }))
    };
  } catch (error) {
    return getDefaultProject(project);
  }
}

function getDefaultProject(project) {
  return {
    name: project.name,
    description: project.description,
    files: [
      {
        path: 'src/index.js',
        content: `/**
 * ${project.name}
 * ${project.description}
 */

export function main() {
  console.log('Hello from ${project.name}');
}

export default main;`
      },
      {
        path: 'package.json',
        content: JSON.stringify({
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
        }, null, 2)
      },
      {
        path: 'README.md',
        content: `# ${project.name}

${project.description}

## Installation

\`\`\`bash
npm install ${project.name}
\`\`\`

## Usage

\`\`\`javascript
import { main } from '${project.name}';

main();
\`\`\`

## License

MIT`
      },
      {
        path: 'tests/index.test.js',
        content: `import { describe, it } from 'node:test';
import assert from 'node:assert';
import { main } from '../src/index.js';

describe('${project.name}', () => {
  it('should export main function', () => {
    assert(typeof main === 'function');
  });
});`
      }
    ];
  }
}
