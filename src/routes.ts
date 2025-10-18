import { AutoRouter, withContent, cors, IRequest, json } from "itty-router";
import { tokenLingoTranslate } from "@/routes/[token]/lingo/translate";
import { tokenKvIdSet } from "@/routes/[token]/kv/[id]/set";
import { tokenKvIdReset } from "@/routes/[token]/kv/[id]/reset";
import { tokenKvIdGet } from "@/routes/[token]/kv/[id]/get";
import { tokenLingoConfigure } from "@/routes/[token]/lingo/configure";
import { tokenLingoToLanguage } from "@/routes/[token]/lingo/to/[language]";

// get preflight and corsify pair
const { preflight, corsify } = cors();

// export our router with preflight and corsify middleware enabled
export const router = AutoRouter({
  before: [preflight],
  finally: [corsify],
});

router.all("/", async (req) => {
  return json({ error: "no token provided" }, { status: 400 });
});

/*
Key-Value routes (storage APIs)
*/

router.all<IRequest, [Env]>("/:token/kv/:id/set", withContent, tokenKvIdSet);

router.all<IRequest, [Env]>(
  "/:token/kv/:id/reset",
  withContent,
  tokenKvIdReset
);

router.get<IRequest, [Env]>("/:token/kv/:id/get", tokenKvIdGet);

/*
Lingo routes (translation APIs)
*/

router.all<IRequest, [Env]>(
  "/:token/lingo/configure",
  withContent,
  tokenLingoConfigure
);

router.all<IRequest, [Env]>(
  "/:token/lingo/translate",
  withContent,
  tokenLingoTranslate
);

router.all<IRequest, [Env]>(
  "/:token/lingo/to/:language",
  withContent,
  tokenLingoToLanguage
);
