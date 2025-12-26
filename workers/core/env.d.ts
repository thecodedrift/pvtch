// Additional environment variables that are set via secrets or dev vars
// These extend the generated Env interface from worker-configuration.d.ts

declare global {
  interface Env {
    // Secrets (set via wrangler secret)
    TWITCH_SECRET?: string;

    // Development variables (set in .dev.vars or programmatically)
    DEVELOPMENT?: string;
    DISABLE_CACHE?: boolean;
  }
}

export {};
