import z from 'zod';

export const LINGO_KEY = 'lingo-config';

export const lingoConfig = z.object({
  bots: z.array(z.string()),
  language: z.string(),
});

export type LingoConfig = z.infer<typeof lingoConfig>;

export const DEFAULT_LINGO_CONFIG: LingoConfig = {
  bots: [],
  language: 'english',
};
