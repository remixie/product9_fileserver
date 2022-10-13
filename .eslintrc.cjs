module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 12,
    sourceType: "module",
    parser: "@typescript-eslint/parser",
  },
  plugins: ["vue", "@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:vue/vue3-recommended"],
  rules: {
    // override/add rules settings here, such as:
  },
};
