import type { DeepPartial } from "node_modules/astro/dist/type-utils";
import { useEffect, useState } from "react";

export const useHashParameters = <T>(defaults?: DeepPartial<T>) => {
  // watches the hash parameters for changes and returns a memoized object of the parameters
  const [hashParams, setHashParams] = useState(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const obj: Record<string, string> = {
      ...((defaults as Record<string, string>) ?? {}),
    };
    params.forEach((value, key) => {
      if (value && value.length > 0) {
        obj[key] = value;
      }
    });
    return obj as DeepPartial<T>;
  });

  useEffect(() => {
    const onHashChange = () => {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const obj: Record<string, string> = {
        ...((defaults as Record<string, string>) ?? {}),
      };
      params.forEach((value, key) => {
        if (value && value.length > 0) {
          obj[key] = value;
        }
      });
      setHashParams(obj as DeepPartial<T>);
    };

    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  return hashParams;
};
