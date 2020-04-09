module.exports = [
  // Add support for native node modules
  {
    test: /\.node$/,
    use: "node-loader",
  },
  {
    test: /\.(m?js|node)$/,
    parser: { amd: false },
    rules: [
      {
        use: [
          {
            loader: "@marshallofsound/webpack-asset-relocator-loader",
            options: {
              outputAssetBase: "native_modules",
            },
          },
        ],
      },
      {
        include: /discord.js|prism-media/,
        use: [
          {
            loader: "babel-loader",
            options: {
              plugins: [
                "@babel/plugin-proposal-optional-catch-binding",
                "transform-require-default",
              ],
            },
          },
        ],
      },
    ],
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
];
