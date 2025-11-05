module.exports = {
  extends: ['plugin:vue/vue3-recommended', 'eslint:recommended'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  env: { browser: true, es2021: true },
  globals: {
    defineProps: 'readonly',
    defineEmits: 'readonly',
    defineExpose: 'readonly',
    withDefaults: 'readonly',
  },
  rules: {},
}