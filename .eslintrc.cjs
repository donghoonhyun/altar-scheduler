// .eslintrc.cjs
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  ignorePatterns: [
    "dist/",
    "node_modules/",
    "emulator-data/",
    "functions/**" ,
  ],
  settings: {
  "import/resolver": {
    alias: {
      map: [["@", "./src"]],
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    },
  },
},
};
