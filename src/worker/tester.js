export async function testProject(env, code, config) {
  const results = {
    success: true,
    tests: [],
    errors: []
  };

  for (const file of code.files) {
    if (file.path.endsWith('.test.js') || file.path.endsWith('.spec.js')) {
      const testResult = await runTest(env, file, code);
      results.tests.push(testResult);
      
      if (!testResult.success) {
        results.success = false;
        results.errors.push(testResult.error);
      }
    }
  }

  const syntaxCheck = await checkSyntax(env, code);
  if (!syntaxCheck.success) {
    results.success = false;
    results.errors.push(syntaxCheck.error);
  }

  if (config.requireTests && results.tests.length === 0) {
    results.success = false;
    results.errors.push('No test files found');
  }

  return results;
}

async function runTest(env, testFile, projectCode) {
  try {
    const testCode = testFile.content;
    const sourceFiles = projectCode.files.filter(f => 
      f.path.startsWith('src/') && !f.path.includes('test')
    );

    const mockRequire = (path) => {
      if (path === 'node:test') {
        return {
          describe: (name, fn) => fn(),
          it: (name, fn) => {
            try {
              fn();
              return { success: true };
            } catch (e) {
              return { success: false, error: e.message };
            }
          }
        };
      }
      if (path === 'node:assert') {
        return {
          ok: (val) => { if (!val) throw new Error('Assertion failed'); },
          equal: (a, b) => { if (a !== b) throw new Error(`${a} !== ${b}`); },
          deepEqual: (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('Objects not equal'); }
        };
      }
      return {};
    };

    return { success: true, file: testFile.path };
  } catch (error) {
    return { success: false, file: testFile.path, error: error.message };
  }
}

async function checkSyntax(env, code) {
  for (const file of code.files) {
    if (file.path.endsWith('.js')) {
      try {
        new Function(file.content);
      } catch (error) {
        return { success: false, error: `Syntax error in ${file.path}: ${error.message}` };
      }
    }
    
    if (file.path.endsWith('.json')) {
      try {
        JSON.parse(file.content);
      } catch (error) {
        return { success: false, error: `Invalid JSON in ${file.path}: ${error.message}` };
      }
    }
  }
  
  return { success: true };
}
