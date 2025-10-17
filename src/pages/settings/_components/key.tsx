import { Button } from "@/components/ui/button";
import { ClipboardCopyIcon } from "@/components/ui/icons/lucide-clipboard-copy";
import { PencilIcon } from "@/components/ui/icons/lucide-pencil";
import { Input } from "@/components/ui/input";
import { usePvtchToken, usePvtchTokenMutator } from "@/hooks/usePvtchToken";
import { toast } from "sonner";
import { useCallback, useRef, useState } from "react";

export const Key = () => {
  const currentToken = usePvtchToken();
  const saveToken = usePvtchTokenMutator();
  const [isEditing, setIsEditing] = useState(false);
  const keyRef = useRef<HTMLInputElement>(null);

  const copyKey = useCallback(async () => {
    if (!globalThis.window || !currentToken) {
      return;
    }

    await globalThis.window.navigator.clipboard.writeText(currentToken);

    toast("Copied PVTCH key to clipboard");
  }, [currentToken]);

  const handleOnSaveKey = useCallback(() => {
    if (keyRef.current && keyRef.current.value.length > 20) {
      saveToken(keyRef.current.value);
    }

    setIsEditing(false);
    toast("Updated your PVTCH key");
  }, [saveToken]);

  return (
    <>
      <p>
        Your key is a generated string that is unique to your PVTCH instance,{" "}
        <strong>and must be kept private</strong>. If someone else has your key,
        they could change your overlay data, so keep it private.
      </p>
      <p>
        So copy this down, keep it safe. If you change computers or browsers,
        you might need to tell PVTCH who you are again; if that happens, paste
        your key back in and hit <strong>update</strong>.
      </p>
      <section className="flex flex-col gap-1">
        <div className="flex w-full max-w-sm items-center gap-2">
          <Input
            ref={keyRef}
            type={isEditing ? "text" : "password"}
            readOnly={!isEditing}
            defaultValue={currentToken}
          />
          {isEditing ? (
            <></>
          ) : (
            <>
              <Button variant="ghost" onClick={copyKey}>
                <ClipboardCopyIcon />
              </Button>
            </>
          )}
        </div>
        <div className="flex w-full max-w-sm flex-row items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="default" onClick={handleOnSaveKey}>
                <PencilIcon />
                <span>Update Key</span>
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  if (keyRef.current && currentToken) {
                    keyRef.current.value = currentToken;
                  }
                  setIsEditing(false);
                }}
              >
                <span>Cancel</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(true);
                }}
              >
                <PencilIcon />
                <span>Change Key</span>
              </Button>
            </>
          )}
        </div>
      </section>
    </>
  );
};
