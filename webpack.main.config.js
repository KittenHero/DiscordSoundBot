const TerserPlugin = require("terser-webpack-plugin");
const webpack = require("webpack");
const fs = require("fs");
const util = require("util");
module.exports = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: "./src/main.js",
  // Put your normal webpack config below here
  module: {
    rules: require("./webpack.rules"),
  },
  optimization: {
    concatenateModules: false,
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          keep_classnames: true,
        },
      }),
    ],
  },
  plugins: [
    new webpack.ContextReplacementPlugin(/discord.js.+websocket/, /\/.+.js/),
    new webpack.ContextReplacementPlugin(
      /discord.js.+voice/,
      require.resolve("libsodium-wrappers"),
      { "libsodium-wrappers": require.resolve("libsodium-wrappers") }
    ),
    new webpack.ContextReplacementPlugin(
      /prism-media/,
      require.resolve("@discordjs/opus"),
      { "@discordjs/opus": require.resolve("@discordjs/opus") }
    ),
    new webpack.IgnorePlugin({
      resourceRegExp: /^\.\/\u001a/,
      contextRegExp: /node-pre-gyp/,
    }),
  ],
};
