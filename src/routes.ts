import { AutoRouter, withContent, cors, IRequest, json } from "itty-router";
import { normalizeKey } from "./fn/normalizeKey";

// get preflight and corsify pair
const { preflight, corsify } = cors();

// export our router with preflight and corsify middleware enabled
export const router = AutoRouter({
  before: [preflight],
  finally: [corsify],
});

router.all("/", async (req) => {
  return json({ error: "no token provided" }, { status: 400 });
});

router.all<IRequest, [Env]>(
  "/:token/kv/:id/increment",
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

    let next = 0;

    await stub.gate(async () => {
      // inside the DO, these are atomic operation
      // let next = (await this.ctx.storage.get<number>(token)) || 0;
      let fromKv = (await env.PVTCH_KV.get(normalizedKey)) ?? "";
      if (fromKv.length === 0) {
        fromKv = "0";
      }

      next = Number.parseInt(fromKv, 10) + amount;

      // You do not have to worry about a concurrent request having modified the value in storage.
      // "input gates" will automatically protect against unwanted concurrency.
      // Read-modify-write is safe.
      // await this.ctx.storage.put(token, next);
      await env.PVTCH_KV.put(token, next.toString(), {
        // expires in 24 hours
        expirationTtl: 86400,
      });
    });

    return json({ op: "increment", token, id, value: `${next}` });
  }
);

router.all<IRequest, [Env]>(
  "/:token/kv/:id/set",
  withContent,
  async (request, env) => {
    const { token, id } = request.params as { token: string; id: string };
    const normalizedKey = normalizeKey(token, id);
    const value = request.content?.value ?? request.query?.value ?? "";
    const cdo: DurableObjectId = env.PVTCH_BACKEND.idFromName(normalizedKey);
    const stub = env.PVTCH_BACKEND.get(cdo);

    await stub.gate(async () => {
      await env.PVTCH_KV.put(normalizedKey, value, {
        // expires in 24 hours
        expirationTtl: 86400,
      });
    });

    return json({ op: "set", token, id, value: `${value}` });
  }
);

router.all<IRequest, [Env]>(
  "/:token/kv/:id/reset",
  withContent,
  async (request, env) => {
    const { token, id } = request.params as { token: string; id: string };
    const normalizedKey = normalizeKey(token, id);
    const cdo: DurableObjectId = env.PVTCH_BACKEND.idFromName(normalizedKey);
    const stub = env.PVTCH_BACKEND.get(cdo);

    await stub.gate(async () => {
      await env.PVTCH_KV.put(normalizedKey, "", {
        // expires in 24 hours
        expirationTtl: 86400,
      });
    });

    return json({ op: "reset", token, id, value: "" });
  }
);

router.get<IRequest, [Env]>("/:token/kv/:id/get", async (request, env) => {
  const { token, id } = request.params as { token: string; id: string };
  const normalizedKey = normalizeKey(token, id);
  const cdo: DurableObjectId = env.PVTCH_BACKEND.idFromName(normalizedKey);
  const stub = env.PVTCH_BACKEND.get(cdo);

  let value = "";

  await stub.gate(async () => {
    value = (await env.PVTCH_KV.get(normalizedKey)) ?? "";
  });

  return json({ op: "get", token, id, value });
});
