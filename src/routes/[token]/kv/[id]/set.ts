import { IRequest, json, RequestHandler } from "itty-router";
import { normalizeKey } from "@/fn/normalizeKey";
import { isValidToken } from "@/kv/twitchData";

export const tokenKvIdSet: RequestHandler<IRequest, [Env]> = async (
  request,
  env
) => {
  const { token, id } = request.params as { token: string; id: string };
  const userid = await isValidToken(token, env);

  if (!userid) {
    return json({ op: "get", error: "Invalid token" }, { status: 400 });
  }

  const normalizedKey = normalizeKey(token, id);
  const value = request.content?.value ?? request.query?.value ?? "";
  const cdo: DurableObjectId = env.PVTCH_BACKEND.idFromName(normalizedKey);
  const stub = env.PVTCH_BACKEND.get(cdo);

  // stubs hold their own storage per stub via sqlite
  await stub.set(value);

  return json({ op: "set", token, id, value: `${value}` });
};
