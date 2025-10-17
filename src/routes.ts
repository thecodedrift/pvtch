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
  "/:token/kv/:id/set",
  withContent,
  async (request, env) => {
    const { token, id } = request.params as { token: string; id: string };
    const normalizedKey = normalizeKey(token, id);
    const value = request.content?.value ?? request.query?.value ?? "";
    const cdo: DurableObjectId = env.PVTCH_BACKEND.idFromName(normalizedKey);
    const stub = env.PVTCH_BACKEND.get(cdo);

    // stubs hold their own storage per stub via sqlite
    await stub.set(value);

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

    await stub.set("");

    return json({ op: "reset", token, id, value: "" });
  }
);

router.get<IRequest, [Env]>("/:token/kv/:id/get", async (request, env) => {
  const { token, id } = request.params as { token: string; id: string };
  const normalizedKey = normalizeKey(token, id);
  const cdo: DurableObjectId = env.PVTCH_BACKEND.idFromName(normalizedKey);
  const stub = env.PVTCH_BACKEND.get(cdo);

  const value = await stub.get();

  return json({ op: "get", token, id, value });
});
