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

    // call the method on the DO
    const next = await stub.increment(normalizedKey, amount);

    return json({ op: "increment", token, id, value: `${next}` });
  }
);

router.all<IRequest, [Env]>(
  "/:token/kv/:id/set",
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
  "/:token/kv/:id/reset",
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

router.get<IRequest, [Env]>("/:token/kv/:id/get", async (request, env) => {
  const { token, id } = request.params as { token: string; id: string };
  const normalizedKey = normalizeKey(token, id);

  // go right to the KV since we don't need the input gate for reads
  const fromKv = (await env.PVTCH_KV.get(normalizedKey)) ?? "";

  return json({ op: "get", token, id, value: fromKv });
});
