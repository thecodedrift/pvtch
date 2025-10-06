import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input";
import { useForm } from "@tanstack/react-form";
import type React from "react";
import { useHashParameters } from "@/hooks/useHashParameters";
import type { Options } from "./types";

export const Configure: React.FC = () => {
  const fromUrl = useHashParameters<Options>();

  const form = useForm({
    defaultValues: {
      bgcolor: fromUrl.bgcolor ?? "",
      fgcolor1: fromUrl.fgcolor1 ?? "",
      fgcolor2: fromUrl.fgcolor2 ?? "",
      goal: fromUrl.goal ?? "",
      goaltext: fromUrl.goaltext ?? "",
      progress: "0",
    },
    onSubmit: async ({ value }) => {
      console.log(value)
    },
  });


  return (<>
    <section className="mt-8">
    <h1>Your OBS URL:</h1>
    <Input />
  </section>
  <section className="mt-8">
    <h1>Set It Up</h1>
    <form onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }} className="space-y-6">
    <Field>
      <FieldLabel htmlFor="bgcolor">Bar Background</FieldLabel>
      <Input id="bgcolor" autoComplete="off" placeholder="000000" />
      <FieldDescription
        >The color for the uncompleted part of the bar</FieldDescription>
    </Field>
    <Field>
      <FieldLabel htmlFor="fgcolor1">Filled Background 1</FieldLabel>
      <Input id="fgcolor1" autoComplete="off" placeholder="990000" />
      <FieldDescription
        >The color for the completed part of the bar</FieldDescription>
    </Field>
    <Field>
      <FieldLabel htmlFor="fgcolor2">Filled Background 2</FieldLabel>
      <Input id="fgcolor2" autoComplete="off" placeholder="aa0000" />
      <FieldDescription
        >The second color for the completed bar, make it slightly brighter for a
        cool effect</FieldDescription>
    </Field>
    <Field>
      <FieldLabel htmlFor="goal">Goal Amount</FieldLabel>
      <Input id="goal" autoComplete="off" placeholder="100" />
      <FieldDescription
        >Your arbitrary goal amount. You got this!</FieldDescription>
    </Field>
    <Field>
      <FieldLabel htmlFor="goaltext">Goal Label</FieldLabel>
      <Input id="goaltext" autoComplete="off" placeholder="My Goal Name" />
      <FieldDescription
        >Name your goal, or leave it blank if you'd rather do it in OBS</FieldDescription>
    </Field>
    <Input id="progress" autoComplete="off" placeholder="0" hidden />
    <Button variant="outline" type="submit" onClick={() => form.handleSubmit()}>Save</Button>
    </form>
    </section>
  </>);
}