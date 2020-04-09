const rules = require("./webpack.rules");

module.exports = {
  // Put your normal webpack config below here
  module: {
    rules: rules.concat([
      {
        test: /\.css$/,
        use: [{ loader: "style-loader" }, { loader: "css-loader" }],
      },
      {
        test: /\.svg$/,
        use: [{ loader: "url-loader" }],
      },
    ]),
  },
};
