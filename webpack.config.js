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
      })}
    ]
  },
  plugins: [
    new CopyWebpackPlugin([
      { from: './app/index.html', to: "index.html" },
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
  }
};