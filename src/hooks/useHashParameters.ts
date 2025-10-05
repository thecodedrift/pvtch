import { useEffect, useState } from "react";

export const useHashParameters = () => {
  // watches the hash parameters for changes and returns a memoized object of the parameters
  const [hashParams, setHashParams] = useState(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const obj: Record<string, string> = {};
    params.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  });

  useEffect(() => {
    const onHashChange = () => {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const obj: Record<string, string> = {};
      params.forEach((value, key) => {
        obj[key] = value;
      });
      setHashParams(obj);
    };

    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  return hashParams;
};
