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
  bg: 'rgba(0, 0, 0, 1)',
  fg1: 'rgba(255, 255, 255, 1)',
  fg2: 'rgba(255, 255, 255, 1)',
  goal: 100,
  decimal: 0,
};
