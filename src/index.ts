import { AutoRouter, withContent, cors, IRequest, json } from "itty-router";
import { DurableObject } from "cloudflare:workers";
import { normalizeKey } from "./fn/normalizeKey";

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

    const next = Number.parseInt(fromKv, 10) + value;

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
    await this.env.PVTCH_KV.put(token, value.toString(), {
      // expires in 24 hours
      expirationTtl: TTL,
    });

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

router.all<IRequest, [Env]>(
  "/:token/:id/increment",
  withContent,
  async (request, env) => {
    const { token, id } = request.params as { token: string; id: string };
    const normalizedKey = normalizeKey(token, id);
    const amount: number =
      request.content?.amount ?? request.query?.amount ?? 1;
    // Create a `DurableObjectId` for an instance of the `PvtchBackend`
    // class. By namespacing to the token, we ensure our DO isn't conflicting
    // with another streamer's DO
    const cdo: DurableObjectId = env.PVTCH_BACKEND.idFromName(normalizedKey);

    // Create a stub to open a communication channel with the Durable
    // Object instance. This is what gives us the input gate behavior.
    const stub = env.PVTCH_BACKEND.get(cdo);

    // call the method on the DO
    const next = await stub.increment(normalizedKey, amount);

    return json({ op: "increment", token, id, value: `${next}` });
  }
);

router.all<IRequest, [Env]>(
  "/:token/:id/set",
  withContent,
  async (request, env) => {
    const { token, id } = request.params as { token: string; id: string };
    const normalizedKey = normalizeKey(token, id);
    const value: number = request.content?.value ?? request.query?.value ?? "";
    const cdo: DurableObjectId = env.PVTCH_BACKEND.idFromName(normalizedKey);
    const stub = env.PVTCH_BACKEND.get(cdo);
    const next = await stub.set(normalizedKey, value);

    return json({ op: "set", token, id, value: `${next}` });
  }
);

router.all<IRequest, [Env]>(
  "/:token/:id/reset",
  withContent,
  async (request, env) => {
    const { token, id } = request.params as { token: string; id: string };
    const normalizedKey = normalizeKey(token, id);
    const cdo: DurableObjectId = env.PVTCH_BACKEND.idFromName(normalizedKey);
    const stub = env.PVTCH_BACKEND.get(cdo);
    const next = await stub.set(normalizedKey, "");

    return json({ op: "reset", token, id, value: `${next}` });
  }
);

router.get<IRequest, [Env]>("/:token/:id/get", async (request, env) => {
  const { token, id } = request.params as { token: string; id: string };
  const normalizedKey = normalizeKey(token, id);

  // go right to the KV since we don't need the input gate for reads
  const fromKv = (await env.PVTCH_KV.get(normalizedKey)) ?? "";

  return json({ op: "get", token, id, value: fromKv });
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
