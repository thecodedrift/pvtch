import { IRequest, json, RequestHandler } from "itty-router";
import { normalizeKey } from "@/fn/normalizeKey";
import { isValidToken } from "@/lib/twitchData";
import { DEFAULT_LINGO_CONFIG, LINGO_KEY, lingoConfig } from "../_constants";

export const tokenLingoConfigGet: RequestHandler<IRequest, [Env]> = async (
  request,
  env
) => {
  const { token } = request.params as { token: string; id: string };
  const userid = await isValidToken(token, env);

  if (!userid) {
    return json(
      { op: "token.lingo.config.get", error: "Invalid token" },
      { status: 400 }
    );
  }

  const normalizedKey = normalizeKey(token, LINGO_KEY);
  const cdo: DurableObjectId = env.PVTCH_BACKEND.idFromName(normalizedKey);
  const stub = env.PVTCH_BACKEND.get(cdo);

  const value = await stub.get();

  try {
    const safe = lingoConfig.parse(JSON.parse(value));
    return json(safe);
  } catch {
    return json(DEFAULT_LINGO_CONFIG);
  }
};
