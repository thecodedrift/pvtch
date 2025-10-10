import { AutoRouter, withContent, cors, IRequest, json } from "itty-router";
import { DurableObject } from "cloudflare:workers";

const TTL = 86400; // 1 day

/**
 * A Durable Object's behavior is defined in an exported Javascript class
 * PvtchBackend is designed to provide a single input gate for mutations of data. It's effectively
 * an in memory queue without creating an entire queue system.
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
   * The Durable Object exposes an RPC method sayHello which will be invoked when a Durable
   *  Object instance receives a request from a Worker via the same method invocation on the stub
   *
   * @returns The greeting to be sent back to the Worker
   */
  async increment(token: string, value: number): Promise<number> {
    // inside the DO, these are atomic operation
    // let next = (await this.ctx.storage.get<number>(token)) || 0;
    let fromKv = (await this.env.PVTCH_KV.get(token)) ?? "";
    if (fromKv.length === 0) {
      fromKv = "0";
    }

    const next = parseInt(fromKv, 10) + value;

    // You do not have to worry about a concurrent request having modified the value in storage.
    // "input gates" will automatically protect against unwanted concurrency.
    // Read-modify-write is safe.
    // await this.ctx.storage.put(token, next);
    await this.env.PVTCH_KV.put(token, next.toString(), {
      // expires in 24 hours
      expirationTtl: TTL,
    });

    return next;
  }

  async set(token: string, value: number | string): Promise<number | string> {
    await this.ctx.storage.put(token, value);
    return value;
  }
}

// get preflight and corsify pair
const { preflight, corsify } = cors();
const router = AutoRouter({
  before: [preflight],
  finally: [corsify],
});

router.all("/", async (req) => {
  return json({ error: "no token provided" }, { status: 400 });
});

router.all("/:token", async (req) => {
  const { token } = req.params as { token: string };
  return json(
    { error: "no action provided (get/set/increment)" },
    { status: 400 }
  );
});

router.all<IRequest, [Env]>(
  "/:token/increment",
  withContent,
  async (request, env) => {
    const { token } = request.params as { token: string };
    const amount: number = request.content?.value ?? request.query?.value ?? 1;
    // Create a `DurableObjectId` for an instance of the `PvtchBackend`
    // class. By namespacing to the token, we ensure our DO isn't conflicting
    // with another streamer's DO
    const id: DurableObjectId = env.PVTCH_BACKEND.idFromName(token);

    // Create a stub to open a communication channel with the Durable
    // Object instance. This is what gives us the input gate behavior.
    const stub = env.PVTCH_BACKEND.get(id);

    // call the method on the DO
    const next = await stub.increment(token, amount);

    return json({ token, value: `${next}` });
  }
);

router.get<IRequest, [Env]>("/:token/get", async (request, env) => {
  const { token } = request.params as { token: string };

  // go right to the KV since we don't need the input gate for reads
  const fromKv = (await env.PVTCH_KV.get(token)) ?? "";

  return json({ token, value: fromKv });
});

export default {
  /**
   * This is the standard fetch handler for a Cloudflare Worker
   *
   * @param request - The request submitted to the Worker from the client
   * @param env - The interface to reference bindings declared in wrangler.jsonc
   * @param ctx - The execution context of the Worker
   * @returns The response to be sent back to the client
   */
  async fetch(request, env, ctx): Promise<Response> {
    return router.fetch(request, env);
  },
} satisfies ExportedHandler<Env>;
