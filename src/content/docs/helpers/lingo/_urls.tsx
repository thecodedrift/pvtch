import type React from "react";
import { translateAllUrl, translateTargetUrl } from "./_state";
import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

export const TranslateAllURL: React.FC<{ replacements?: string[][] }> = ({
  replacements,
}) => {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const unsubscribe = translateAllUrl.subscribe((url) => {
      let next = url;
      for (const [find, replace] of replacements ?? []) {
        next = next.replaceAll(find, replace);
      }

      setUrl(next);
    });

    return () => {
      unsubscribe();
    };
  });

  const handleCopy = useCallback(async () => {
    await globalThis.window.navigator.clipboard.writeText(url);
    toast("Copied Translate (all) URL to clipboard");
  }, [url]);

  const show = url && url.length > 0;

  return (
    <div className="flex flex-row items-center gap-2">
      {show ? (
        <>
          <Input readOnly type="password" value={url} />
          <Button variant="ghost" onClick={() => handleCopy()}>
            <CopyIcon />
          </Button>
        </>
      ) : (
        <>
          <Input readOnly value="waiting for saved configuration" />
        </>
      )}
    </div>
  );
};

export const TranslateTargetURL: React.FC = () => {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const unsubscribe = translateTargetUrl.subscribe((url) => {
      setUrl(url);
    });

    return () => {
      unsubscribe();
    };
  });

  const handleCopy = useCallback(async () => {
    await globalThis.window.navigator.clipboard.writeText(url);
    toast("Copied Translate (target) URL to clipboard");
  }, [url]);

  const show = url && url.length > 0;

  return (
    <div className="flex flex-row items-center gap-2">
      {show ? (
        <>
          <Input readOnly type="password" value={url} />
          <Button variant="ghost" onClick={() => handleCopy()}>
            <CopyIcon />
          </Button>
        </>
      ) : (
        <>
          <Input readOnly value="waiting for saved configuration" />
        </>
      )}
    </div>
  );
};
