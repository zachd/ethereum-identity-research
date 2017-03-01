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
      })},
      { test: /\.sol/, loader: "truffle-solidity-loader"}
    ]
  },
  plugins: [
    new CopyWebpackPlugin([
      { from: './app/index.html', to: "index.html" },
      { from: './app/images', to: "images" }
    ]),
    new ExtractTextPlugin("app.css")
  ],
  devServer: {
    stats: 'errors-only',
  }
};