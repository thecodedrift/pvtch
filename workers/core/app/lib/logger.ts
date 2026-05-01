import { createConsola, type ConsolaReporter, type LogObject } from 'consola';

/** Matches 22-character base58 tokens (pvtch token format) */
const BASE58_TOKEN_PATTERN = /\b[1-9A-HJ-NP-Za-km-z]{22}\b/g;

const REDACTED = '[REDACTED]';

/**
 * Redact sensitive tokens from a string.
 * Layer 1: exact-match known tokens.
 * Layer 2: pattern-match any 22-char base58 string as a safety net.
 */
function redact(input: string, knownTokens: ReadonlySet<string>): string {
  let result = input;
  for (const token of knownTokens) {
    result = result.replaceAll(token, REDACTED);
  }
  return result.replaceAll(BASE58_TOKEN_PATTERN, REDACTED);
}

/** Deep-redact all string values in an unknown structure. */
function redactValue(
  value: unknown,
  knownTokens: ReadonlySet<string>
): unknown {
  if (typeof value === 'string') {
    return redact(value, knownTokens);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, knownTokens));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = redactValue(v, knownTokens);
    }
    return out;
  }
  return value;
}

/**
 * A consola reporter that outputs structured JSON with token redaction.
 * Cloudflare Workers natively support structured JSON in their logging
 * infrastructure, making fields queryable in the dashboard and via
 * `wrangler tail --format=json`.
 */
function createRedactingJsonReporter(
  knownTokens: ReadonlySet<string>
): ConsolaReporter {
  return {
    log(logObj: LogObject) {
      const entry = {
        level: logObj.level,
        type: logObj.type,
        tag: logObj.tag ? redact(logObj.tag, knownTokens) : undefined,
        message: redact(
          logObj.args.map((a) => (typeof a === 'string' ? a : '')).join(' '),
          knownTokens
        ),
        data: redactValue(
          logObj.args.find((a) => typeof a === 'object'),
          knownTokens
        ),
        timestamp: logObj.date.toISOString(),
      };

      // Use the appropriate console method so Cloudflare captures the level
      const method =
        logObj.level < 2 ? 'error' : logObj.level < 3 ? 'warn' : 'log';
      console[method](JSON.stringify(entry));
    },
  };
}

export interface CreateLoggerOptions {
  /** Feature area tag (e.g. 'lingo') */
  feature: string;
  /** Unique request ID for correlation */
  requestId: string;
  /** Twitch user ID */
  userId?: string;
  /** Twitch display name */
  twitchName?: string;
  /** Tokens to redact from all log output */
  redactTokens?: string[];
}

/**
 * Create a per-request logger with structured JSON output, tagging,
 * and automatic token redaction.
 */
export function createLogger(opts: CreateLoggerOptions) {
  const knownTokens = new Set(opts.redactTokens ?? []);

  let logger = createConsola({
    reporters: [createRedactingJsonReporter(knownTokens)],
  })
    .withTag(opts.feature)
    .withTag(opts.requestId);

  if (opts.userId) {
    logger = logger.withTag(`uid:${opts.userId}`);
  }

  if (opts.twitchName) {
    logger = logger.withTag(`@${opts.twitchName}`);
  }

  return logger;
}
