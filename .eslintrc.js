module.exports = {
  extends: [
    '@electron-toolkit/eslint-config-ts',
    '@electron-toolkit/eslint-config-prettier'
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/prefer-const': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
    'no-var': 'error'
  },
  ignorePatterns: [
    'out/**/*',
    'dist/**/*',
    'node_modules/**/*',
    '*.js'
  ]
};
