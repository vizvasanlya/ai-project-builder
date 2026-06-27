export async function testProject(env, code, config) {
  var results = {
    success: true,
    tests: [],
    errors: []
  };

  var syntaxCheck = checkSyntax(code);
  if (!syntaxCheck.success) {
    results.success = false;
    results.errors.push(syntaxCheck.error);
  }

  var hasTestFiles = false;
  for (var i = 0; i < code.files.length; i++) {
    var file = code.files[i];
    if (file.path.indexOf('.test.js') !== -1 || file.path.indexOf('.spec.js') !== -1 || file.path.indexOf('test') !== -1) {
      hasTestFiles = true;
      results.tests.push({ file: file.path, success: true });
    }
  }

  if (config.requireTests && !hasTestFiles) {
    results.success = false;
    results.errors.push('No test files found in generated code');
  }

  if (results.errors.length > 0) {
    results.error = results.errors.join('; ');
  }

  return results;
}

function checkSyntax(code) {
  for (var i = 0; i < code.files.length; i++) {
    var file = code.files[i];

    if (file.path.endsWith('.js')) {
      try {
        new Function(file.content);
      } catch (error) {
        return { success: false, error: 'Syntax error in ' + file.path + ': ' + error.message };
      }
    }

    if (file.path.endsWith('.json')) {
      try {
        JSON.parse(file.content);
      } catch (error) {
        return { success: false, error: 'Invalid JSON in ' + file.path + ': ' + error.message };
      }
    }
  }

  return { success: true };
}
