export type TwitchUserData = {
  id: string;
  login: string;
  display_name: string;
  token: string; // generated string unique to the user. "secret"
};

export const twitchDataKeyPrefix = "twitch-data-";

// reverse maps a token to a Twitch user ID
export type TokenData = string; // Twitch user ID

export const tokenDataKeyPrefix = "token-data-";

export const isValidToken = async (token: string | undefined, env: Env) => {
  if (!token) return undefined;

  const tokenKey = `${tokenDataKeyPrefix}${token}`;
  const tokenLookup = await env.PVTCH_ACCOUNTS.get<TokenData>(tokenKey);

  return tokenLookup ?? undefined;
};
