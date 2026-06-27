import { handleApi } from './api/index.js';
import { handleCron } from './worker/cron.js';
import { handleQueue } from './worker/queue.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, ctx);
    }
    
    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleCron(env));
  },

  async queue(batch, env) {
    await handleQueue(batch, env);
  }
};
