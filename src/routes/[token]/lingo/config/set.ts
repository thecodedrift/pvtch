import { IRequest, json, RequestHandler } from "itty-router";
import { normalizeKey } from "@/fn/normalizeKey";
import { isValidToken } from "@/lib/twitchData";
import { TTLOptions } from "@/do/backend";
import { lingoConfig } from "../_constants";

const ID = "lingo-config";
const TTL_OPTIONS: TTLOptions = {
  strategy: "PRESERVE_ON_FETCH",
  ttlMs: 30 * 24 * 60 * 60 * 1000, // 30 days
};

export const tokenLingoConfigSet: RequestHandler<IRequest, [Env]> = async (
  request,
  env
) => {
  const { token } = request.params as { token: string; id: string };
  const userid = await isValidToken(token, env);

  if (!userid) {
    return json(
      { op: "token.lingo.config.set", error: "Invalid token" },
      { status: 400 }
    );
  }

  const normalizedKey = normalizeKey(token, ID);
  const value = request.content?.value ?? request.query?.value ?? "";
  const cdo: DurableObjectId = env.PVTCH_BACKEND.idFromName(normalizedKey);
  const stub = env.PVTCH_BACKEND.get(cdo);

  try {
    const result = lingoConfig.safeParse(JSON.parse(value));
    if (!result.success) {
      console.log("Invalid lingo config set attempt", { errors: result.error });
      return json(
        { op: "token.lingo.config.set", error: "Invalid lingo config" },
        { status: 400 }
      );
    }
  } catch (e) {
    console.log("Error parsing lingo config set attempt", { error: e });
    return json(
      { op: "token.lingo.config.set", error: "Invalid lingo config" },
      { status: 400 }
    );
  }

  // stubs hold their own storage per stub via sqlite
  await stub.set(value, TTL_OPTIONS);

  return json(JSON.parse(value));
};
