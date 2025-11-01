import { useCallback, useEffect, useState } from "react";
import { useInterval } from "usehooks-ts";
import { PVTCH_API } from "@/constants";
import { toast } from "sonner";
import useCookie from "./useCookie";

const FETCH_INTERVAL = 3000; // ms

export const usePvtchMutator = (key: string) => {
  const [token] = useCookie("pvtch_token");
  const save = useCallback(
    async (value: string) => {
      if (!token || !key) {
        return;
      }

      const url = new URL(PVTCH_API);
      url.pathname = `/${token}/kv/${key}/set`;

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value }),
      });

      if (!response.ok) {
        toast.error("Failed to save value to Pvtch");
        console.error(
          "Failed to save value",
          response.status,
          await response.text(),
        );
        return false;
      }

      return true;
    },
    [key, token],
  );
  return save;
};

/** Get a value from PVTCH k/v with a refetch API */
export const usePvtchValue = (key: string, existingToken?: string) => {
  const [token] = useCookie("pvtch_token");
  const [value, setValue] = useState<string | undefined>(undefined);

  const activeToken = existingToken ?? token;

  const refetch = useCallback(async () => {
    if (!activeToken || !key) {
      return;
    }

    const url = new URL(PVTCH_API);
    url.pathname = `/${activeToken}/kv/${key}/get`;

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error(
        "Failed to fetch pvtch value",
        response.status,
        await response.text(),
      );
      return;
    }

    const data = await response.json();
    if (data && typeof data.value === "string") {
      setValue(data.value);
    } else {
      console.error("Invalid response data", data);
    }
  }, [token, key]);

  useEffect(() => {
    refetch().catch((e) => {
      console.error(e);
    });
  }, [token, key]);

  return [value, refetch] as const;
};

/** Hook to get a value from Pvtch by key, updating every second */
export const useUpdatingPvtchValue = (
  key: string,
  token?: string,
  interval?: number,
) => {
  const [value, setValue] = useState<string | undefined>(undefined);

  useInterval(() => {
    const run = async () => {
      if (!token || !key) {
        return;
      }

      const url = new URL(PVTCH_API);
      url.pathname = `/${token}/kv/${key}/get`;

      const response = await fetch(url.toString());
      if (!response.ok) {
        console.error(
          "Failed to fetch pvtch value",
          response.status,
          await response.text(),
        );
        return;
      }

      const data = await response.json();
      if (data && typeof data.value === "string") {
        setValue(data.value);
      } else {
        console.error("Invalid response data", data);
      }
    };

    run().catch((e) => {
      console.error(e);
    });
  }, interval ?? FETCH_INTERVAL);

  return value;
};
