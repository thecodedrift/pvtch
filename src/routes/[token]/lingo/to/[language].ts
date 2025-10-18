import { IRequest, json, RequestHandler } from "itty-router";

export const tokenLingoToLanguage: RequestHandler<IRequest, [Env]> = async (
  request,
  env
) => {
  const { token } = request.params as { token: string };

  return json({});
};
