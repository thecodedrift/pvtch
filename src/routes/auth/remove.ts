import { IRequest, json, RequestHandler } from "itty-router";
import {
  TokenData,
  tokenDataKeyPrefix,
  twitchDataKeyPrefix,
  TwitchUserData,
} from "@/lib/twitchData";

export const authRemove: RequestHandler<IRequest, [Env]> = async (
  request,
  env
) => {
  const username = request.content?.username;
  const token = request.content?.token;

  if (!username) {
    return json({ error: "No username provided" }, { status: 400 });
  }

  if (!token) {
    return json({ error: "No token provided" }, { status: 400 });
  }

  const tokenKey = `${tokenDataKeyPrefix}${token}`;
  const tokenLookup = await env.PVTCH_ACCOUNTS.get<TokenData>(tokenKey);

  if (!tokenLookup) {
    return json({ error: "Invalid token" }, { status: 400 });
  }

  const twitchDataKey = `${twitchDataKeyPrefix}${tokenLookup}`;
  const twitchData = await env.PVTCH_ACCOUNTS.get<TwitchUserData>(
    twitchDataKey,
    "json"
  );

  if (
    !twitchData ||
    twitchData.login.toLocaleLowerCase() !== username.toLocaleLowerCase()
  ) {
    return json({ error: "Username does not match token" }, { status: 400 });
  }

  // delete both entries
  await env.PVTCH_ACCOUNTS.delete(tokenKey);
  await env.PVTCH_ACCOUNTS.delete(twitchDataKey);

  return json({ success: true, message: "Authentication removed" });
};
