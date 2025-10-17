export type Options = {
  token?: string;
  bgcolor: string;
  fgcolor1: string;
  fgcolor2: string;
  goal: string;
  decimal: string;
  goaltext?: string;
  id: string;
  prefix?: string;
};

// TODO: better name
export const prefix = "progress-";

export const defaults: Options = {
  token: undefined,
  goaltext: undefined,
  prefix: undefined,
  bgcolor: "000000",
  fgcolor1: "ffffff",
  fgcolor2: "ffffff",
  goal: "100",
  decimal: "0",
  id: "default",
};
