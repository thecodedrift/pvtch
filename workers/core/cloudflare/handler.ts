import { createRequestHandler, RouterContextProvider } from 'react-router';
import {
  cloudflareEnvironmentContext,
  cloudflareExecutionContext,
} from '../app/context';

// Re-export Durable Object for Cloudflare
export { PvtchBackend } from '../do/backend';

const requestHandler = createRequestHandler(
  () => import('virtual:react-router/server-build'),
  import.meta.env.MODE
);

export default {
  async fetch(request, env, ctx) {
    // Create a RouterContextProvider instance for v8_middleware
    const context = new RouterContextProvider();

    // Set Cloudflare-specific contexts using v8 middleware pattern
    context.set(cloudflareEnvironmentContext, env);
    context.set(cloudflareExecutionContext, ctx);

    return requestHandler(request, context);
  },
} satisfies ExportedHandler<Env>;
