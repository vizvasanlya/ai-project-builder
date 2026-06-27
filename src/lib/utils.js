export function generateId() {
  return `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function formatDate(date) {
  return new Date(date).toISOString().split('T')[0];
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function truncate(str, length) {
  if (str.length <= length) return str;
  return str.slice(0, length - 3) + '...';
}

export function retry(fn, maxRetries = 3, delay = 1000) {
  return async (...args) => {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error;
        if (i < maxRetries - 1) {
          await sleep(delay * Math.pow(2, i));
        }
      }
    }
    throw lastError;
  };
}
