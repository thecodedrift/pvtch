import process from "process";
import { IRequest, RequestHandler } from "itty-router";

export const authStart: RequestHandler<IRequest, [Env]> = async (
  request,
  env
) => {
  const u = new URL("https://id.twitch.tv/oauth2/authorize");
  u.searchParams.set("client_id", process.env.TWITCH_CLIENT_ID || "");
  u.searchParams.set("response_type", "code");
  u.searchParams.set(
    "redirect_uri",
    process.env.TWITCH_REDIRECT_URI || "http://localhost:8787/auth/callback"
  );
  u.searchParams.set("scope", "");

  // TODO: state info? app you were on, csrf, etc

  // redirect to twitch oauth2 authorize
  return new Response(null, {
    status: 302,
    headers: {
      Location: u.toString(),
    },
  });
};

/*
https://id.twitch.tv/oauth2/authorize
    ?response_type=code
    &client_id=hof5gwx0su6owfnys0nyan9c87zr6t
    &redirect_uri=http://localhost:3000
    &scope=channel%3Amanage%3Apolls+channel%3Aread%3Apolls
    &state=c3ab8aa609ea11e793ae92361f002671
*/
