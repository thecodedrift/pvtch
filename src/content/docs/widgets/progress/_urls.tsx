import type React from "react";
import { progressUrl, updateProgressUrl } from "./_state";
import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

export const SourceURL: React.FC = () => {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const unsubscribe = progressUrl.subscribe((url) => {
      setUrl(url);
    });

    return () => {
      unsubscribe();
    };
  });

  const handleCopy = useCallback(async () => {
    await globalThis.window.navigator.clipboard.writeText(url);
    toast("Copied Browser Source URL to clipboard");
  }, [url]);

  return (
    <div className="flex flex-row items-center gap-2">
      <Input readOnly type="password" value={url} />
      <Button variant="ghost" onClick={() => handleCopy()}>
        <CopyIcon />
      </Button>
    </div>
  );
};

export const UpdateURL: React.FC = () => {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const unsubscribe = updateProgressUrl.subscribe((url) => {
      setUrl(url);
    });

    return () => {
      unsubscribe();
    };
  });

  const handleCopy = useCallback(async () => {
    await globalThis.window.navigator.clipboard.writeText(url);
    toast("Copied Update Command URL to clipboard");
  }, [url]);

  return (
    <div className="flex flex-row items-center gap-2">
      <Input readOnly type="password" value={url} />
      <Button variant="ghost" onClick={() => handleCopy()}>
        <CopyIcon />
      </Button>
    </div>
  );
};
