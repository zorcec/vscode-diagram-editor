import tseslint from 'typescript-eslint';
import js from '@eslint/js';

export default tseslint.config(
  // Ignore build artefacts, generated files and config scripts
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/test-results/**',
      '**/.vscode-test/**',
      '*.config.mjs',
    ],
  },

  // Baseline JS recommended rules
  js.configs.recommended,

  // typescript-eslint strict + stylistic — the community-standard TypeScript config
  // (equivalent quality to eslint-config-airbnb for JavaScript)
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,

  // TypeScript parser config with JSX support
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // ── Unused variables ──────────────────────────────────────────────────
      // Allow _-prefixed parameters and variables (intentionally ignored)
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],

      // ── Loops and control flow ─────────────────────────────────────────────
      // for...of is idiomatic in TypeScript
      'no-restricted-syntax': 'off',
      // i++ / i-- are fine in loops
      'no-plusplus': 'off',
      // continue is useful for early loop exit
      'no-continue': 'off',
      // Awaiting in loops is common in sequential extension operations
      'no-await-in-loop': 'off',

      // ── Class patterns ────────────────────────────────────────────────────
      // VS Code provider/tool classes often have static-looking methods
      'class-methods-use-this': 'off',

      // ── Parameter reassignment ────────────────────────────────────────────
      // Allow mutating object properties but not the binding itself
      'no-param-reassign': ['error', { props: false }],

      // ── Identifiers ───────────────────────────────────────────────────────
      'no-underscore-dangle': 'off',

      // ── TypeScript specific ───────────────────────────────────────────────
      // Demote to warn — VS Code API types require any in several places
      '@typescript-eslint/no-explicit-any': 'warn',

      // Interfaces preferred over type aliases for object shapes
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],

      // Allow empty functions (required by VS Code lifecycle callbacks)
      '@typescript-eslint/no-empty-function': 'off',

      // Allow non-null assertions — needed when VS Code API can return undefined unexpectedly
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // Allow explicit void/ignore for fire-and-forget async calls
      'no-void': ['error', { allowAsStatement: true }],

      // Relax consistent return — mixed async patterns in extension code
      'consistent-return': 'off',
    },
  },

  // Relax rules for test files (mocks, assertions, any types are expected)
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-await-in-loop': 'off',
    },
  },

  // E2E files use Playwright fixture patterns that require empty destructuring {} 
  {
    files: ['**/e2e/**/*.ts'],
    rules: {
      'no-empty-pattern': 'off',
    },
  },
);

