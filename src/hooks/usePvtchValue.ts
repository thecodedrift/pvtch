import { useState } from "react";
import { useInterval } from "usehooks-ts";
import { PVTCH_API } from "@/constants";

const FETCH_INTERVAL = 3000; // ms

/** Hook to get a value from Pvtch by key, updating every second */
export const usePvtchValue = (
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
