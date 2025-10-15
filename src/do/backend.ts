import { DurableObject } from "cloudflare:workers";

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

  /**
   * Adds an input gate lock, useful for serializing operations such as writes that
   * you would normally put into a queue. DO's are a lot lighter than a full queue,
   * as long as they are performing single operations. You should not be doing
   * long running tasks in a DO.
   * @param runWithLock - The async function to run with the input gate lock
   * @returns
   */
  async gate(runWithLock: () => Promise<void>): Promise<void> {
    return this.ctx.blockConcurrencyWhile(runWithLock);
  }
}
