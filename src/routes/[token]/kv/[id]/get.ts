import { IRequest, json, RequestHandler } from "itty-router";
import { normalizeKey } from "@/fn/normalizeKey";

export const tokenKvIdGet: RequestHandler<IRequest, [Env]> = async (
  request,
  env
) => {
  const { token, id } = request.params as { token: string; id: string };
  const normalizedKey = normalizeKey(token, id);
  const cdo: DurableObjectId = env.PVTCH_BACKEND.idFromName(normalizedKey);
  const stub = env.PVTCH_BACKEND.get(cdo);

  const value = await stub.get();

  return json({ op: "get", token, id, value });
};
