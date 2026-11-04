import stylistic from '@stylistic/eslint-plugin';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '.build-*/**', 'src/server/runtime/**'] },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts'],
  })),
  prettier,
  {
    files: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts'],
    plugins: { '@stylistic': stylistic },
    rules: {
      curly: ['error', 'all'],
      '@stylistic/lines-between-class-members': [
        'error',
        'always',
        { exceptAfterSingleLine: true },
      ],
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: ['if', 'for', 'while', 'do', 'switch', 'return'] },
        { blankLine: 'always', prev: ['if', 'for', 'while', 'do', 'switch'], next: '*' },
      ],
    },
  },
);
