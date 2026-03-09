import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPlatformProxy } from 'wrangler';
import { translate, isSameLanguage } from '@/lib/translator';

type Fixture = {
  input: string;
  expected: {
    language: string | string[];
  };
  preserveTokens?: string[];
  /** If true, isSameLanguage should return true even if the LLM misdetects the language. */
  expectSameLanguage?: boolean;
};

const TARGET_LANGUAGE = 'English';

const fixtures: Fixture[] = [
  {
    input: "Don't mind nanopanther, he's got a case of the drifties",
    expected: { language: 'English' },
  },
  {
    input:
      'Added Quote 101: "I never interrupt Mommy-.. I mean Cortana" - @saintnoble [Halo: The Master Chief Collection] [11/02/2026]',
    expected: { language: 'English' },
    preserveTokens: ['@saintnoble'],
  },
  {
    input: 'galing na curlyg5Wow',
    expected: { language: ['Tagalog', 'Filipino'] },
    preserveTokens: ['curlyg5Wow'],
  },
  {
    input: 'kumusta na tayo, @ohaiDrifty ? f0x64Marbie',
    expected: { language: ['Tagalog', 'Filipino'] },
    preserveTokens: ['@ohaiDrifty', 'f0x64Marbie'],
  },
  {
    input: "I shouldn't be translated thecod67Lol",
    expected: { language: 'English' },
    preserveTokens: ['thecod67Lol'],
  },
  {
    input: 'haiiiiii chelle!',
    expected: { language: 'English' },
    expectSameLanguage: true,
  },
  {
    input: "내 황홀에 취해, you can't look away",
    expected: { language: 'Korean' },
  },
  {
    input:
      'Yeah relaunching provides completely different data. Things are randomized to ensure you sstay anonymous with each browser launch in Mullvad',
    expected: { language: 'English' },
  },
  {
    input: 'I should get 2/3rds of that payout, yeah?',
    expected: { language: 'English' },
  },
  {
    input: 'heya kaph',
    expected: { language: 'English' },
    expectSameLanguage: true,
  },
  {
    input: 'heheheh',
    expected: { language: 'English' },
    expectSameLanguage: true,
  },
];

let env: Env;
let dispose: () => Promise<void>;

beforeAll(async () => {
  const proxy = await getPlatformProxy<Env>({
    configPath: './wrangler.jsonc',
  });
  env = proxy.env;
  dispose = proxy.dispose;
});

afterAll(async () => {
  await dispose();
});

describe('lingo translation', () => {
  for (const fixture of fixtures) {
    it(`translates: "${fixture.input.slice(0, 50)}..."`, async () => {
      const result = await translate(fixture.input, {
        env,
        targetLanguage: TARGET_LANGUAGE,
      });

      // Success
      expect(result.success).toBe(true);
      if (!result.success) return;

      // Valid ISO 639-3 code (3 lowercase letters)
      expect(result.data.detectedCode).toMatch(/^[a-z]{3}$/);

      // Non-empty translation
      expect(result.data.translation.length).toBeGreaterThan(0);

      // For fixtures that may be misdetected by the LLM but should be caught
      // by the script-mismatch guard, verify isSameLanguage returns true
      if (fixture.expectSameLanguage) {
        expect(isSameLanguage(TARGET_LANGUAGE, fixture.input, result)).toBe(
          true
        );
        return;
      }

      // Language detection
      const expectedLangs = Array.isArray(fixture.expected.language)
        ? fixture.expected.language
        : [fixture.expected.language];
      expect(expectedLangs).toContain(result.data.detected);

      // Token preservation
      if (fixture.preserveTokens) {
        for (const token of fixture.preserveTokens) {
          expect(result.data.translation).toContain(token);
        }
      }
    });
  }
});
