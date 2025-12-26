export type Options = {
  bg: string;
  fg1: string;
  fg2: string;
  goal: number;
  decimal: number;
  text?: string;
  prefix?: string;
};

export const defaults: Options = {
  text: undefined,
  prefix: undefined,
  bg: '000000',
  fg1: 'ffffff',
  fg2: 'ffffff',
  goal: 100,
  decimal: 0,
};
