const path = require("path");

module.exports = [
  /*
  // Add support for native node modules
  {
    test: /\.node$/,
    use: {
      loader: "node-loader-relative",
      options: { basePath: path.join(__dirname, ".webpack", "main") },
    },
  },
  */
  {
    test: /\.(m?js|node)$/,
    parser: { amd: false },
    use: {
      loader: "@marshallofsound/webpack-asset-relocator-loader",
      options: {
        outputAssetBase: "native_modules",
      },
    },
  },
  // Put your webpack loader rules in this array.  This is where you would put
  // your ts-loader configuration for instance:
  /**
   * Typescript Example:
   *
   * {
   *   test: /\.tsx?$/,
   *   exclude: /(node_modules|.webpack)/,
   *   loaders: [{
   *     loader: 'ts-loader',
   *     options: {
   *       transpileOnly: true
   *     }
   *   }]
   * }
   */
  {
    test: /\.js$/,
    include: /discord.js|prism-media/,
    use: {
      loader: "babel-loader",
      options: {
        plugins: [
          "@babel/plugin-proposal-optional-catch-binding",
          "transform-require-default",
          "./util/babel-plugin",
        ],
      },
    },
  },
];
