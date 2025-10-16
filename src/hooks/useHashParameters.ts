import type { DeepPartial } from "node_modules/astro/dist/type-utils";
import { useEffect, useState } from "react";

const parseHash = <T extends Record<string, string>>() => {
  if (!globalThis.window) return {};
  const params = new URLSearchParams(window.location.hash.slice(1));
  return Object.fromEntries(params.entries()) as DeepPartial<T>;
};

export const useHashParameters = <T extends Record<string, string>>(
  defaults?: T,
) => {
  // watches the hash parameters for changes and returns a memoized object of the parameters
  const [hashParams, setHashParams] = useState(() => {
    return {
      ...defaults,
      ...parseHash<T>(),
    } as DeepPartial<T>;
  });

  useEffect(() => {
    const onHashChange = () => {
      const next = {
        ...defaults,
        ...parseHash<T>(),
      } as DeepPartial<T>;
      setHashParams(next);
    };

    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  return hashParams;
};
