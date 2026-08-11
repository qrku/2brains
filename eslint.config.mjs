import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import tseslint from 'typescript-eslint';
import jest from 'eslint-plugin-jest';
import playwright from 'eslint-plugin-playwright';
import prettier from 'eslint-config-prettier';

// `eslint-config-next` is still eslintrc-shaped; FlatCompat is the supported bridge into flat config.
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'node_modules/**',
      'next-env.d.ts',
      // Generated from the icon set by scratchpad/gen-icons.mjs — lint would only fight the generator.
      'src/shared/ui/Icon.tsx',
    ],
  },

  ...compat.extends('next/core-web-vitals'),
  ...tseslint.configs.recommended,

  {
    rules: {
      // The codebase already writes `_`-prefixed throwaways; keep that the escape hatch.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      // `ignoreReadBeforeAssign` keeps forward declarations legal — `let f: () => void`
      // referenced by a closure defined above its assignment cannot be a const.
      'prefer-const': ['error', { ignoreReadBeforeAssign: true }],
      'no-var': 'error',
    },
  },

  // Node-side tooling: plain scripts, no browser globals, console is the output channel.
  {
    files: ['scripts/**/*.mjs', '*.config.{ts,mjs,js}', 'jest.setup.ts'],
    rules: { 'no-console': 'off' },
  },

  {
    files: ['**/*.test.{ts,tsx}', 'jest.setup.ts'],
    ...jest.configs['flat/recommended'],
    rules: {
      ...jest.configs['flat/recommended'].rules,
      'jest/expect-expect': ['error', { assertFunctionNames: ['expect', 'expect*'] }],
    },
  },

  {
    files: ['e2e/**/*.ts'],
    ...playwright.configs['flat/recommended'],
  },

  // Must stay last: switches off every rule Prettier owns.
  prettier,
);
