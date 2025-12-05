import { AutoRouter, withContent, cors, IRequest, json } from "itty-router";
import { tokenLingoTranslate } from "@/routes/[token]/lingo/translate";
import { tokenKvIdSet } from "@/routes/[token]/kv/[id]/set";
import { tokenKvIdGet } from "@/routes/[token]/kv/[id]/get";
// import { tokenLingoToLanguage } from "@/routes/[token]/lingo/to/[language]";
import { authStart } from "./routes/auth/start";
import { authCallback } from "./routes/auth/callback";
import { authRemove } from "./routes/auth/remove";

// get preflight and corsify pair
const { preflight, corsify } = cors();

// export our router with preflight and corsify middleware enabled
export const router = AutoRouter({
  before: [preflight],
  finally: [corsify],
});

// TODO redirect to pvtch
router.all("/", async (req) => {
  return json({ error: "no token provided" }, { status: 400 });
});

/*
Auth
*/
router.get<IRequest, [Env]>("/auth/start", authStart);
router.get<IRequest, [Env]>("/auth/callback", authCallback);
router.post<IRequest, [Env]>("/auth/remove", withContent, authRemove);

/*
Key-Value routes (storage APIs)
*/

router.all<IRequest, [Env]>("/:token/kv/:id/set", withContent, tokenKvIdSet);
router.get<IRequest, [Env]>("/:token/kv/:id/get", tokenKvIdGet);

/*
Lingo routes (translation APIs)
*/

router.all<IRequest, [Env]>(
  "/:token/lingo/translate",
  withContent,
  tokenLingoTranslate
);

// router.all<IRequest, [Env]>(
//   "/:token/lingo/to/:language",
//   withContent,
//   tokenLingoToLanguage
// );
