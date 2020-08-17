const path = require('path')
const webpack = require('webpack')

const ENV = process.env.NODE_ENV || 'development'
const isDev = ENV !== 'production'

module.exports = {
  context: path.resolve(__dirname, 'src'),
  entry: './fanlock.js',

  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/dist',
    filename: 'fanlock.js',
    library: 'FanLock',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },

  resolve: {
    extensions: ['.js', '.json'],
  },

  devtool: isDev ? 'cheap-module-source-map' : 'source-map',

  devServer: {
    port: process.env.PORT || 8010,
    host: 'localhost',
    contentBase: './dev',
  }
}
