import RequireTwitchLogin from "@/components/RequireTwitchLogin";
import { Button } from "@/components/ui/button";
import { FieldLabel, Field, FieldDescription } from "@/components/ui/field";
import useCookie from "@/hooks/useCookie";
import { usePvtchMutator, usePvtchValue } from "@/hooks/usePvtchValue";
import { BasicBar } from "@/pages/sources/progress/_index";
import { useForm, useStore } from "@tanstack/react-form";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useState } from "react";
import Sticky from "react-sticky-el";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { progressUrl, updateProgressUrl } from "./_state";
import { PVTCH_API } from "@/constants";

const defaults = {
  fg1: "#ffffff",
  fg2: "#ffffff",
  bg: "#000000",
  goal: 100,
  text: "",
  decimal: 0,
  prefix: "",
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
    fg1: parsed.fg1 ?? defaults.fg1,
    fg2: parsed.fg2 ?? defaults.fg2,
    bg: parsed.bg ?? defaults.bg,
    goal: parsed.goal ?? defaults.goal,
    text: parsed.text ?? defaults.text,
    decimal: parsed.decimal ?? defaults.decimal,
    prefix: parsed.prefix ?? defaults.prefix,
  };
};

export default function Configure() {
  const [token] = useCookie("pvtch_token");
  const [id, setId] = useState("default");
  const [tempId, setTempId] = useState("default");
  const [changingId, setChangingId] = useState(false);
  const progressKey = `progress-${id}`;
  const configKey = `progress-${id}-config`;
  const [config, refreshConfig] = usePvtchValue(configKey);
  const parsedConfig = useMemo(() => {
    if (!config) {
      return defaults;
    }
    const parsed = parseConfig(config);
    return parsed;
  }, [config]);

  const saveConfig = usePvtchMutator(configKey);
  const form = useForm({
    defaultValues: parsedConfig,
    onSubmit: async ({ value }) => {
      const save = JSON.stringify(value);
      await saveConfig(save);
      toast.success("Progress bar configuration saved!");
      refreshConfig();
    },
  });

  useEffect(() => {
    if (!config) {
      return;
    }
    const parsed = parseConfig(config);
    form.reset(parsed);

    // update the atoms
    const u = new URL(window.location.origin);
    u.pathname = "/sources/progress";
    const sp = new URLSearchParams();
    sp.set("token", token ?? "");
    sp.set("id", progressKey);
    u.hash = "#" + sp.toString();
    progressUrl.set(u.toString());

    const updateUrl = new URL(PVTCH_API);
    updateUrl.pathname = `/${token}/kv/${progressKey}/set`;
    const updateParams = new URLSearchParams();
    updateParams.set("value", "UPDATEME");
    updateUrl.search = updateParams.toString();
    updateProgressUrl.set(updateUrl.toString());
  }, [config]);

  const formState = useStore(form.store, (s) => {
    return s.values;
  });

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
        <div className="flex flex-row gap-2 pb-4">
          <Input
            value={tempId}
            name="id-selector"
            readOnly={!changingId}
            className={!changingId ? "pointer-events-none opacity-50" : ""}
            onChange={(e) => setTempId(e.target.value)}
          />
          {changingId ? (
            <>
              <Button
                variant="default"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setTempId(id);
                  setChangingId(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="action"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setId(tempId);
                  setChangingId(false);
                }}
              >
                Load
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  setTempId(id);
                  setChangingId(true);
                }}
                variant="default"
                type="button"
              >
                Switch
              </Button>
              <Button variant="action" type="submit">
                Save
              </Button>
            </>
          )}
        </div>
        <Sticky stickyClassName="pt-[80px]">
          <div className="relative h-12 w-full">
            <BasicBar
              bg={formState.bg}
              fg1={formState.fg1}
              fg2={formState.fg2}
              goal={formState.goal}
              text={formState.text}
              decimal={formState.decimal}
              prefix={formState.prefix}
              progress={64}
              embedded
            />
          </div>
        </Sticky>
        <div
          className={cn(
            "flex flex-col gap-6 pt-4",
            changingId ? "pointer-events-none opacity-50" : "",
          )}
        >
          <form.Field
            name="bg"
            children={(field) => (
              <Field>
                <FieldLabel htmlFor="bg">Bar Background</FieldLabel>
                <Input
                  id="bg"
                  autoComplete="off"
                  placeholder="#000000"
                  name={field.name}
                  value={field.state.value}
                  onBlur={() => {
                    field.handleBlur();
                  }}
                  onChange={(e) => field.handleChange(e.target.value)}
                  readOnly={changingId}
                />
                <FieldDescription>
                  The color for the uncompleted part of the bar
                </FieldDescription>
              </Field>
            )}
          />
          <form.Field
            name="fg1"
            children={(field) => (
              <Field>
                <FieldLabel htmlFor="fg1">Filled Background 1</FieldLabel>
                <Input
                  id="fg1"
                  autoComplete="off"
                  placeholder="#990000"
                  name={field.name}
                  value={field.state.value}
                  onBlur={() => {
                    field.handleBlur();
                  }}
                  onChange={(e) => field.handleChange(e.target.value)}
                  readOnly={changingId}
                />
                <FieldDescription>
                  The color for the completed part of the bar
                </FieldDescription>
              </Field>
            )}
          />
          <form.Field
            name="fg2"
            children={(field) => (
              <Field>
                <FieldLabel htmlFor="fg2">Filled Background 2</FieldLabel>
                <Input
                  id="fg2"
                  autoComplete="off"
                  placeholder="#aa0000"
                  name={field.name}
                  value={field.state.value}
                  onBlur={() => {
                    field.handleBlur();
                  }}
                  onChange={(e) => field.handleChange(e.target.value)}
                  readOnly={changingId}
                />
                <FieldDescription>
                  The second color for the completed bar, make it slightly
                  brighter for a cool gradient effect
                </FieldDescription>
              </Field>
            )}
          />
          <form.Field
            name="goal"
            children={(field) => (
              <Field>
                <FieldLabel htmlFor="goal">Goal Amount</FieldLabel>
                <Input
                  id="goal"
                  autoComplete="off"
                  placeholder="100"
                  name={field.name}
                  value={field.state.value}
                  onBlur={() => {
                    field.handleBlur();
                  }}
                  onChange={(e) =>
                    field.handleChange(parseInt(e.target.value, 10))
                  }
                  readOnly={changingId}
                />
                <FieldDescription>
                  Your arbitrary goal amount. You got this!
                </FieldDescription>
              </Field>
            )}
          />
          <form.Field
            name="text"
            children={(field) => (
              <Field>
                <FieldLabel htmlFor="text">Goal Text</FieldLabel>
                <Input
                  id="text"
                  autoComplete="off"
                  placeholder="My Goal Name"
                  name={field.name}
                  value={field.state.value}
                  onBlur={() => {
                    field.handleBlur();
                  }}
                  onChange={(e) => field.handleChange(e.target.value)}
                  readOnly={changingId}
                />
                <FieldDescription>
                  Name your goal, or leave it blank if you'd rather do it in OBS
                </FieldDescription>
              </Field>
            )}
          />
          <form.Field
            name="prefix"
            children={(field) => (
              <Field>
                <FieldLabel htmlFor="prefix">Prefix</FieldLabel>
                <Input
                  id="prefix"
                  autoComplete="off"
                  placeholder=""
                  name={field.name}
                  value={field.state.value}
                  onBlur={() => {
                    field.handleBlur();
                  }}
                  onChange={(e) => field.handleChange(e.target.value)}
                  readOnly={changingId}
                />
                <FieldDescription>
                  Add a prefix before Progress and Goal numbers, e.g. "$" or
                  "Level "
                </FieldDescription>
              </Field>
            )}
          />
          <form.Field
            name="decimal"
            children={(field) => (
              <Field>
                <FieldLabel htmlFor="decimal">Round Progress Places</FieldLabel>
                <Input
                  id="decimal"
                  autoComplete="off"
                  placeholder="0"
                  name={field.name}
                  value={field.state.value}
                  onBlur={() => {
                    field.handleBlur();
                  }}
                  onChange={(e) => field.handleChange(parseInt(e.target.value))}
                  readOnly={changingId}
                />
                <FieldDescription>
                  Round the progress number to this many decimal places, great
                  if you're doing a bunch of math in your bot, or want to show a
                  progress amount like 53.191723
                </FieldDescription>
              </Field>
            )}
          />
        </div>
      </form>
    </div>
  );
}
