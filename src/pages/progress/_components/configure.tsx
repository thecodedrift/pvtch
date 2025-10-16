import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useForm } from "@tanstack/react-form";
import React, { useCallback } from "react";
import { useHashParameters } from "@/hooks/useHashParameters";
import { defaults, type Options } from "./options";
import type { DeepPartial } from "node_modules/astro/dist/type-utils";
import { usePvtchToken } from "@/hooks/usePvtchToken";
import { objectToParams, paramsToObject } from "@/lib/params";

export const Configure: React.FC = () => {
  const token = usePvtchToken();
  const optionsToUrl = useCallback(
    (values: DeepPartial<Options>) => {
      const params = objectToParams(
        { ...values, token },
        {
          // verify a valid decimal
          decimal: (value) => {
            if (!value) {
              return undefined;
            }

            const number = parseInt(value, 10);
            if (!isNaN(number)) {
              return number.toString();
            }

            return undefined;
          },
        },
      );

      const newUrl = `${window.location.origin}/progress/live#${params.toString()}`;
      return newUrl;
    },
    [token],
  );

  const fromUrl = useHashParameters<Options>(defaults);
  const [url, setUrl] = React.useState(optionsToUrl(fromUrl));

  const form = useForm({
    defaultValues: fromUrl,
    onSubmit: async ({ value }) => {
      const newUrl = optionsToUrl(value);
      setUrl(newUrl);
      // http://localhost:4321/progress/live#progress=37.0000061&goal=50&goaltext=Fox+Field+Trip&fgcolor1=FF9B28&fgcolor2=ffffff&bgcolor=20828F
    },
  });

  return (
    <>
      <section className="mt-8">
        <h1>Set It Up</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="space-y-6"
        >
          <div>
            <h2>Your OBS URL:</h2>
            <Input value={url} readOnly />
            <iframe src={url} className="mt-4 h-12 w-full" />
          </div>
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
                  Round the progress number to this many decimal places, great
                  if you're doing a bunch of math in your bot
                </FieldDescription>
              </Field>
            )}
          />
        </form>
      </section>
    </>
  );
};
