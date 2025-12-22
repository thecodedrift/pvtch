import { IRequest, json, RequestHandler } from "itty-router";
import { normalizeKey } from "@/fn/normalizeKey";
import { isValidToken } from "@/lib/twitchData";
import { TTLOptions } from "@/do/backend";
import { PROGRESS_KEY, progressValue } from "../_constants";

export const tokenProgressControlSet: RequestHandler<IRequest, [Env]> = async (
  request,
  env
) => {
  const { token, name } = request.params as { token: string; name: string };
  const userid = await isValidToken(token, env);

  if (!userid) {
    return json({ error: "Invalid token" }, { status: 400 });
  }

  const fqn = `${PROGRESS_KEY}::${name}`;
  const normalizedKey = normalizeKey(token, fqn);
  const value = request.content?.value ?? request.query?.value ?? "";
  const cdo: DurableObjectId = env.PVTCH_BACKEND.idFromName(normalizedKey);
  const stub = env.PVTCH_BACKEND.get(cdo);

  const parsed = progressValue.safeParse(value);
  if (!parsed.success) {
    console.log("Invalid progress value set attempt", { errors: parsed.error });
    return json({ error: "Invalid progress value" }, { status: 400 });
  }

  // stubs hold their own storage per stub via sqlite
  await stub.set(value);

  return json({ _: value });
};
