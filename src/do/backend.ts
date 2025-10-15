import { DurableObject } from "cloudflare:workers";

const TTL = 86400; // 1 day

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

  async increment(token: string, value: number): Promise<number> {
    let next = 0;

    // use blockConcurrencyWhile to specifically ensure the DO processes one request
    // at a time for its identifier
    // required because PVTCH_KV is eventually consistent and we want to ensure
    // updates arrive in order. If this becomes an issue, we can migrate to a proper queue
    this.ctx.blockConcurrencyWhile(async () => {
      // inside the DO, these are atomic operation
      // let next = (await this.ctx.storage.get<number>(token)) || 0;
      let fromKv = (await this.env.PVTCH_KV.get(token)) ?? "";
      if (fromKv.length === 0) {
        fromKv = "0";
      }

      next = Number.parseInt(fromKv, 10) + value;

      // You do not have to worry about a concurrent request having modified the value in storage.
      // "input gates" will automatically protect against unwanted concurrency.
      // Read-modify-write is safe.
      // await this.ctx.storage.put(token, next);
      await this.env.PVTCH_KV.put(token, next.toString(), {
        // expires in 24 hours
        expirationTtl: TTL,
      });
    });

    return next;
  }

  async set(token: string, value: number | string): Promise<number | string> {
    this.ctx.blockConcurrencyWhile(async () => {
      await this.env.PVTCH_KV.put(token, value.toString(), {
        // expires in 24 hours
        expirationTtl: TTL,
      });
    });

    return value;
  }
}
