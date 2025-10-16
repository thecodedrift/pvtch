import { useIsClient, useLocalStorage } from "usehooks-ts";
import basex from "base-x";
import { useCallback, useEffect, useState } from "react";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const bs58 = basex(BASE58);

const createRandomString = () => {
  const randomBytes = new Uint8Array(16);
  if (typeof globalThis.window !== "undefined" && globalThis.window.crypto) {
    globalThis.window.crypto.getRandomValues(randomBytes);
  } else {
    // Fallback for environments without crypto (e.g., Node.js)
    for (let i = 0; i < randomBytes.length; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }

  const str = bs58.encode(randomBytes);
  return str.padStart(22, "1").slice(0, 22); // ensure length is 22
};

const PVTCH_TOKEN_KEY = "pvtch::token";

/** Retrieve the user's Pvtch token from localstorage, and if it doesn't exist, make it */
export const usePvtchToken = () => {
  const [token, setToken] = useLocalStorage(PVTCH_TOKEN_KEY, "");
  const isBrowser = useIsClient();

  useEffect(() => {
    if (isBrowser && (!token || token.length === 0)) {
      const newToken = createRandomString();
      setToken(newToken);
    }
  }, [isBrowser, token]);

  return token === "" ? undefined : token;
};

export const usePvtchTokenMutator = () => {
  const [_, setToken] = useLocalStorage(PVTCH_TOKEN_KEY, "");
  const isBrowser = useIsClient();

  const save = useCallback(
    (newToken: string) => {
      if (!isBrowser) {
        return;
      }

      setToken(newToken);
    },
    [isBrowser],
  );

  return save;
};
