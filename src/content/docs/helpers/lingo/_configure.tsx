import RequireTwitchLogin from "@/components/RequireTwitchLogin";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PVTCH_API } from "@/constants";
import useCookie from "@/hooks/useCookie";
import { usePvtchMutator, usePvtchValue } from "@/hooks/usePvtchValue";
import { useForm } from "@tanstack/react-form";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { translateAllUrl, translateTargetUrl } from "./_state";
import { Button } from "@/components/ui/button";

const defaults: {
  bots: string[];
  language: string;
  isNew?: true;
} = {
  bots: [],
  language: "en",
  isNew: true,
};

const parseConfig = (configString?: string) => {
  if (!configString || configString.length === 0) {
    return defaults;
  }

  let parsed: Partial<typeof defaults> = {};
  try {
    parsed = JSON.parse(configString);
  } catch {}

  return {
    bots: [parsed.bots ?? defaults.bots].flat().filter((v) => v !== undefined),
    language: parsed.language ?? defaults.language,
  };
};

export default function Configure() {
  const [token] = useCookie("pvtch_token");
  const configKey = `lingo-config`;
  const [config, refreshConfig] = usePvtchValue(configKey);
  const saveConfig = usePvtchMutator(configKey);
  const parsedConfig = useMemo(() => {
    if (!config) {
      return defaults;
    }
    const parsed = parseConfig(config);
    return parsed;
  }, [config]);

  console.log(parsedConfig);

  const form = useForm({
    defaultValues: {
      bots: (parsedConfig?.bots ?? []).join(", "),
      language: parsedConfig?.language ?? "en",
    },
    onSubmit: async ({ value }) => {
      const save = JSON.stringify({
        bots: value.bots
          .split(",")
          .map((b) => b.trim())
          .filter((b) => b.length > 0),
        language: value.language,
      });
      await saveConfig(save);
      toast.success("Lingo configuration saved!");
      refreshConfig();
    },
  });

  useEffect(() => {
    if (!config) {
      return;
    }
    const parsed = parseConfig(config);
    form.reset({
      bots: parsed.bots?.join(", "),
      language: parsed.language,
    });

    if (parsed.isNew) {
      // no action, no saves made
      return;
    }

    // the translateall url is a PVTCH API endpoint
    const translateAll = new URL(PVTCH_API);
    translateAll.pathname = `/${token}/lingo/translate`;
    const spAll = new URLSearchParams();
    spAll.set("user", "SENDINGUSER");
    spAll.set("message", "MESSAGEHERE");
    translateAll.search = spAll.toString();
    translateAllUrl.set(translateAll.toString());

    // the translate specific url is a PVTCH API endpoint
    const translateTarget = new URL(PVTCH_API);
    translateTarget.pathname = `/${token}/lingo/to/XX`;
    const spTarget = new URLSearchParams();
    spTarget.set("user", "SENDINGUSER");
    spTarget.set("message", "MESSAGEHERE");
    translateTarget.search = spTarget.toString();
    translateTargetUrl.set(translateTarget.toString());
  }, [config]);

  if (!token) {
    return <RequireTwitchLogin />;
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <div className="flex flex-col gap-6">
          <form.Field
            name="bots"
            children={(field) => (
              <Field>
                <FieldLabel htmlFor="bg">Ignored Bots &amp; Users</FieldLabel>
                <Input
                  id="bots"
                  autoComplete="off"
                  placeholder="yourbot, anotherbot, yetanotherbot"
                  name={field.name}
                  value={field.state.value}
                  onBlur={() => {
                    field.handleBlur();
                  }}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldDescription>
                  Any bots or users you want to ignore. Messages from these
                  users will never be translated. Separate names with commas.
                </FieldDescription>
              </Field>
            )}
          />
          <form.Field
            name="language"
            validators={{
              onBlur({ value }) {
                if (value.length !== 2) {
                  return "Must be a 2 character language code";
                }
              },
            }}
            children={(field) => (
              <Field>
                <FieldLabel htmlFor="language">Your Language</FieldLabel>
                <Input
                  id="language"
                  autoComplete="off"
                  placeholder="en"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldDescription>
                  A two-letter language code (like "en" for English, "es" for
                  Spanish, etc). This is what you'll get replies in, so it
                  should be the language you are most comfortbale with.{" "}
                  <a
                    href="https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes"
                    target="_blank"
                  >
                    View All Language Codes
                  </a>
                  {!field.state.meta.isValid && (
                    <em className="text-red-600 dark:text-red-200" role="alert">
                      {" "}
                      {field.state.meta.errors.join(", ")}
                    </em>
                  )}
                </FieldDescription>
              </Field>
            )}
          />
          <div className="flex flex-row items-center justify-end">
            <Button variant="action">Save</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
