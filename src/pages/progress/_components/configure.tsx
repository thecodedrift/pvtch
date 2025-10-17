import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useForm } from "@tanstack/react-form";
import React, { useCallback, useEffect } from "react";
import { useHashParameters } from "@/hooks/useHashParameters";
import { defaults, type Options } from "./options";
import type { DeepPartial } from "node_modules/astro/dist/type-utils";
import { usePvtchToken } from "@/hooks/usePvtchToken";
import { objectToParams, paramsToObject } from "@/lib/params";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PVTCH_API } from "@/constants";
import { toast } from "sonner";
import { ClipboardCopyIcon } from "@/components/ui/icons/lucide-clipboard-copy";

const decimalHandler = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  const number = parseInt(value, 10);
  if (!isNaN(number)) {
    return number.toString();
  }

  return undefined;
};

const createApiUrl = (token: string, key: string) => {
  // https://api.pvtch.com/:token/kv/progress-:key/set?value=40
  const url = new URL(PVTCH_API);
  url.pathname = `/${token}/kv/progress-${key}/set`;

  const sp = new URLSearchParams();
  sp.set("value", "0");
  url.search = sp.toString();

  return url.toString();
};

export const Configure: React.FC = () => {
  const token = usePvtchToken();
  const optionsToUrl = useCallback(
    (values: DeepPartial<Options>) => {
      const params = objectToParams(
        { ...values, token },
        {
          // verify a valid decimal
          decimal: decimalHandler,
        },
      );

      const newUrl = `${window.location.origin}/progress/live#${params.toString()}`;
      return newUrl;
    },
    [token],
  );

  const fromUrl = useHashParameters<Options>(defaults);
  const [url, setUrl] = React.useState(optionsToUrl(fromUrl));
  const [apiUrl, setApiUrl] = React.useState("");

  useEffect(() => {
    if (!token || !fromUrl.id) {
      return;
    }

    setApiUrl(createApiUrl(token, fromUrl.id));
  }, [token, fromUrl.id]);

  const copyBrowserUrl = useCallback(async () => {
    if (!globalThis.window || !url) {
      return;
    }

    await globalThis.window.navigator.clipboard.writeText(url);
    toast("Copied browser source URL to clipboard");
  }, [url]);

  const copyAPIUrl = useCallback(async () => {
    if (!globalThis.window || !apiUrl) {
      return;
    }

    await globalThis.window.navigator.clipboard.writeText(apiUrl);
    toast("Copied API URL to clipboard");
  }, [apiUrl]);

  const form = useForm({
    defaultValues: fromUrl,
    onSubmit: async ({ value }) => {
      const newUrl = optionsToUrl(value);
      setUrl(newUrl);
      const configureParams = objectToParams(value, {
        decimal: decimalHandler,
      });

      if (globalThis.window) {
        const newHash = configureParams.toString();
        if (newHash !== window.location.hash.slice(1)) {
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}#${newHash}`,
          );
        }
      }
    },
  });

  return (
    <>
      <h2>Your OBS URL:</h2>
      <section className="sticky top-0 bg-white pb-8 dark:bg-black">
        <iframe src={url} className="my-4 h-12 w-full" />
        <Dialog>
          <DialogTrigger asChild>
            <Button>Get The Code</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Your URLs</DialogTitle>
              <DialogDescription>
                You'll use the <strong>browser</strong> URL in your streaming
                software (like OBS) to display your progress bar. You'll use the{" "}
                <strong>update</strong> URL to update your progress from your
                bot such as Firebot, MixItUp, Streamer.bot, and more.
              </DialogDescription>
            </DialogHeader>
            <section>
              <h3 className="mt-4 text-lg font-medium">Browser URL</h3>
              <div className="flex w-full items-center gap-2">
                <Input value={url} readOnly className="w-full" />
                <Button variant="ghost" onClick={copyBrowserUrl}>
                  <ClipboardCopyIcon />
                </Button>
              </div>
            </section>
            <section>
              <h3 className="mt-4 text-lg font-medium">Update URL</h3>
              <div className="prose prose-sm dark:prose-invert">
                <p>
                  To update the progress bar, you'll call a URL from your stream
                  bot's software.
                </p>
                <ul>
                  <li>
                    MixItUp:{" "}
                    <a
                      href="https://wiki.mixitupapp.com/en/actions/web-request-action"
                      target="_blank"
                    >
                      Web Request Action
                    </a>
                  </li>
                  <li>
                    Firebot:{" "}
                    <a
                      href="https://docs.firebot.app/v5/core/effects#list-of-firebot-effects"
                      target="_blank"
                    >
                      HTTP Request Effect
                    </a>
                  </li>
                  <li>
                    Streamer.bot:{" "}
                    <a
                      href="https://docs.streamer.bot/api/sub-actions/core/network/fetch-url"
                      target="_blank"
                    >
                      fetch-url Sub-Action
                    </a>
                  </li>
                </ul>
              </div>
              <div className="flex w-full items-center gap-2">
                <Input value={apiUrl} readOnly className="w-full" />
                <Button variant="ghost" onClick={copyAPIUrl}>
                  <ClipboardCopyIcon />
                </Button>
              </div>
            </section>
          </DialogContent>
        </Dialog>
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className="space-y-6"
      >
        <form.Field
          name="id"
          children={(field) => (
            <Field>
              <FieldLabel htmlFor="id">ID (short name)</FieldLabel>
              <Input
                id="id"
                autoComplete="off"
                placeholder="default"
                name={field.name}
                value={field.state.value}
                onBlur={() => {
                  field.handleBlur();
                  form.handleSubmit();
                }}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              <FieldDescription>
                A short name so you can tell this bar apart from others
              </FieldDescription>
            </Field>
          )}
        />
        <form.Field
          name="bgcolor"
          children={(field) => (
            <Field>
              <FieldLabel htmlFor="bgcolor">Bar Background</FieldLabel>
              <Input
                id="bgcolor"
                autoComplete="off"
                placeholder="000000"
                name={field.name}
                value={field.state.value}
                onBlur={() => {
                  field.handleBlur();
                  form.handleSubmit();
                }}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              <FieldDescription>
                The color for the uncompleted part of the bar
              </FieldDescription>
            </Field>
          )}
        />
        <form.Field
          name="fgcolor1"
          children={(field) => (
            <Field>
              <FieldLabel htmlFor="fgcolor1">Filled Background 1</FieldLabel>
              <Input
                id="fgcolor1"
                autoComplete="off"
                placeholder="990000"
                name={field.name}
                value={field.state.value}
                onBlur={() => {
                  field.handleBlur();
                  form.handleSubmit();
                }}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              <FieldDescription>
                The color for the completed part of the bar
              </FieldDescription>
            </Field>
          )}
        />
        <form.Field
          name="fgcolor2"
          children={(field) => (
            <Field>
              <FieldLabel htmlFor="fgcolor2">Filled Background 2</FieldLabel>
              <Input
                id="fgcolor2"
                autoComplete="off"
                placeholder="aa0000"
                name={field.name}
                value={field.state.value}
                onBlur={() => {
                  field.handleBlur();
                  form.handleSubmit();
                }}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              <FieldDescription>
                The second color for the completed bar, make it slightly
                brighter for a cool effect
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
                  form.handleSubmit();
                }}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              <FieldDescription>
                Your arbitrary goal amount. You got this!
              </FieldDescription>
            </Field>
          )}
        />
        <form.Field
          name="goaltext"
          children={(field) => (
            <Field>
              <FieldLabel htmlFor="goaltext">Goal Label</FieldLabel>
              <Input
                id="goaltext"
                autoComplete="off"
                placeholder="My Goal Name"
                name={field.name}
                value={field.state.value}
                onBlur={() => {
                  field.handleBlur();
                  form.handleSubmit();
                }}
                onChange={(e) => field.handleChange(e.target.value)}
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
                  form.handleSubmit();
                }}
                onChange={(e) => field.handleChange(e.target.value)}
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
                  form.handleSubmit();
                }}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              <FieldDescription>
                Round the progress number to this many decimal places, great if
                you're doing a bunch of math in your bot
              </FieldDescription>
            </Field>
          )}
        />
      </form>
    </>
  );
};
