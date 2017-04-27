var path = require('path');
var webpack = require("webpack");
var CopyWebpackPlugin = require('copy-webpack-plugin');
var ExtractTextPlugin = require("extract-text-webpack-plugin");

module.exports = {
  entry: './app/javascripts/app.js',
  output: {
     path: path.resolve(__dirname, "build"),
    filename: 'app.js'
  },
  module: {
    rules: [
      { test: /\.js$/, exclude: /node_modules/, loader: "babel-loader"},
      { test: /\.css$/, use: ExtractTextPlugin.extract({
          fallback: "style-loader", use: "css-loader"
        })
      },
      { test: /\.(eot|png|svg|[ot]tf|woff2?)(\?v=\d+\.\d+\.\d+)?$/,
       loader: 'url-loader', query: {limit: 10000}
      }
    ]
  },
  plugins: [
    new CopyWebpackPlugin([
      { from: './app/index.html', to: "index.html" },
      { from: './app/user/index.html', to: "user/index.html" },
      { from: './app/images', to: "images" },
      { from: './contracts', to: "contracts" }
    ]),
    new ExtractTextPlugin("app.css")
  ],
  devServer: {
    stats: 'errors-only',
  },
  resolve: {
    alias: {
      zlib: 'browserify-zlib-next'
    }
  },
  externals: [
    'canvas'
  ]
};