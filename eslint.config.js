import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import unicorn from 'eslint-plugin-unicorn';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['node_modules/', 'dist/', 'build/', '.wrangler/'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  unicorn.configs['flat/recommended'],
  prettierConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // File naming conventions - enforce kebab-case for all TS/TSX files
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'unicorn/filename-case': [
        'error',
        {
          case: 'kebabCase',
          ignore: [
            // React Router convention files
            '^_.*\\.tsx$', // _index.tsx, _layout.tsx, etc.
            '^\\$\\.tsx$', // $.tsx (catch-all route)
            '.*\\.server\\.(ts|tsx)$', // *.server.ts and *.server.tsx files
          ],
        },
      ],
      'unicorn/prevent-abbreviations': 'off',
      // Disable forced numeric separators - 5000 is more readable than 5_000
      'unicorn/numeric-separators-style': 'off',
      // Allow underscore-prefixed variables to be unused
      '@typescript-eslint/no-unused-vars': [
        'off',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  }
);
