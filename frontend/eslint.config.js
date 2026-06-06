import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'vite.config.ts'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: [
      'src/pages/home/**/*.{ts,tsx}',
      'src/pages/profile/**/*.{ts,tsx}',
      'src/pages/explore/**/*.{ts,tsx}',
      'src/pages/saved/**/*.{ts,tsx}',
      'src/app/Layout.tsx',
      'src/app/AdminLayout.tsx',
      'src/features/comments/**/*.{ts,tsx}',
      'src/features/posts/components/PostCard.tsx',
      'src/features/posts/components/PostActions.tsx',
      'src/features/notifications/**/*.{ts,tsx}',
      'src/shared/ui/**/*.{ts,tsx}',
    ],
    ignores: ['src/shared/ui/**'], // Allow raw elements/colors inside shared/ui itself
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXOpeningElement[name.name="button"]',
          message: 'Do not use raw <button> elements. Use the shared/ui <Button> component instead.',
        },
        {
          selector: 'JSXOpeningElement[name.name="input"]',
          message: 'Do not use raw <input> elements. Use the shared/ui <Input> component instead.',
        },
        {
          selector: 'JSXOpeningElement[name.name="textarea"]',
          message: 'Do not use raw <textarea> elements. Use the shared/ui <Textarea> component instead.',
        },
        {
          selector: 'JSXAttribute[name.name="className"] Literal[value=/\\b(bg|text|border|ring|decoration|outline|fill|stroke)-\\[/]',
          message: 'Do not use hardcoded arbitrary Tailwind colors (e.g. bg-[...], text-[...]). Use standard theme variables or classes from the design system.',
        },
        {
          selector: 'JSXAttribute[name.name="className"] TemplateElement[value.raw=/\\b(bg|text|border|ring|decoration|outline|fill|stroke)-\\[/]',
          message: 'Do not use hardcoded arbitrary Tailwind colors (e.g. bg-[...], text-[...]). Use standard theme variables or classes from the design system.',
        },
      ],
    },
  },
];
