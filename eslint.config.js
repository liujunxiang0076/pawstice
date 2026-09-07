import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'output/**', '.playwright-cli/**'] },
  js.configs.recommended,
  { files: ['src/**/*.js'], languageOptions: { globals: globals.browser } },
  {
    files: ['tests/**/*.js', '*.config.js', 'scripts/**/*.js'],
    languageOptions: { globals: globals.node },
  },
  { rules: { 'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }] } },
];
