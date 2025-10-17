import { DurableObject } from "cloudflare:workers";

// slightly longer than 24h
const TTL = 25 * 60 * 60 * 1000;

/**
 * A Durable Object's behavior is defined in an exported Javascript class
 * PvtchBackend is designed to provide a single input gate for mutations of data. It's effectively
 * an in memory queue without creating an entire queue system.
 *
 * The Durable Object uses blockConcurrencyWhile to ensure that only one request
 * is being processed at a time. This ensures that write operations are
 * in serial while reads can be done in parallel off the KV store.
 *
 * You should only add methods here when you absolutely need sequencing. Otherwise just use the KV directly.
 */
export class PvtchBackend extends DurableObject<Env> {
  /**
   * The constructor is invoked once upon creation of the Durable Object, i.e. the first call to
   * 	`DurableObjectStub::get` for a given identifier (no-op constructors can be omitted)
   *
   * @param ctx - The interface for interacting with Durable Object state
   * @param env - The interface to reference bindings declared in wrangler.jsonc
   */
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async set(value: string): Promise<void> {
    const exp = Date.now() + TTL;
    await this.ctx.storage.put("data", value);
    await this.ctx.storage.put("exp", exp);
    await this.ctx.storage.deleteAlarm(); // best effort
    await this.ctx.storage.setAlarm(exp);
  }

  async get(): Promise<string> {
    const value = (await this.ctx.storage.get<string>("data")) ?? "";
    return value;
  }

  async alarm() {
    const expires = await this.ctx.storage.get<number>("exp");
    if (expires && expires < Date.now()) {
      await this.ctx.storage.deleteAll();
    }
  }
}
