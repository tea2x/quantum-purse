const path = require('path');
module.exports = function (config) {
  config.set({
    frameworks: ["mocha"],
    files: [
      "tests/*.test.ts",
      {
        pattern: "node_modules/sphincs-plus-key-vault-web/sphincs_plus_key_vault_web_bg.wasm",
        type: "wasm",
        served: true,
        included: false,
      },
    ],
    preprocessors: {
      "tests/**/*.ts": ["webpack"],
    },
    webpack: {
      mode: "development",
      module: {
        rules: [
          {
            test: /\.(ts|js)$/,
            use: [
              {
                loader: "babel-loader",
                options: {
                  presets: ["@babel/preset-env"],
                },
              },
              "ts-loader",
            ],
            exclude: /node_modules/,
          },
          {
            test: /\.wasm$/,
            type: "asset/resource",
          },
          {
            test: /\.toml$/,
            use: "file-loader",
          },
        ],
      },
      resolve: {
        extensions: [".ts", ".js"]
      },
    },
    mime: {
      "application/wasm": ["wasm"],
    },
    browsers: ["Chrome"],
    singleRun: true,
    plugins: [
      "karma-mocha",
      "karma-chai",
      "karma-chrome-launcher",
      "karma-webpack",
    ],
    logLevel: config.LOG_INFO,
  });
};
