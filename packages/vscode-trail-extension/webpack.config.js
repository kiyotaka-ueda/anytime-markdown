//@ts-check

'use strict';

const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

/** @typedef {import('webpack').Configuration} WebpackConfig **/

/** @type WebpackConfig */
const extensionConfig = {
  target: 'node',
  mode: 'development',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
  },
  externals: {
    vscode: 'commonjs vscode',
    // ws のオプショナルなネイティブ依存を除外（バンドルなしで動作する）
    bufferutil: 'commonjs bufferutil',
    'utf-8-validate': 'commonjs utf-8-validate',
    // pg のオプションネイティブバインディング (pg-native) は未インストール。
    // pg.native を参照しない限りロードされないため外部化で OK。
    'pg-native': 'commonjs pg-native',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  // typescript の内部プラグインローダーが動的 require を使うため
  // 「Critical dependency: the request of a dependency is an expression」警告
  // が出るが、実害なし (typescript 自身の plugin 機構は使っていない)。
  // 過去 typescript を externalize して回避していたが VSIX 配布では node_modules
  // が同梱されないためランタイムで Cannot find module 'typescript' になり拡張が
  // 起動しない。bundle に含めて警告は ignore する方針に戻す。
  ignoreWarnings: [
    {
      module: /node_modules[\\/]typescript[\\/]lib[\\/]typescript\.js$/,
      message: /Critical dependency: the request of a dependency is an expression/,
    },
  ],
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules[\\/](?!@anytime-markdown[\\/]trail-core)/,
        use: [{
          loader: 'ts-loader',
          options: {
            allowTsInNodeModules: true,
            transpileOnly: true,
          },
        }],
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [{
        from: path.resolve(__dirname, '../../node_modules/sql.js/dist/sql-asm.js'),
        to: 'sql-asm.js',
      }],
    }),
  ],
  devtool: 'nosources-source-map',
};

/** @type WebpackConfig */
const trailStandaloneConfig = {
  target: 'web',
  // ブラウザに WebSocket 経由で配信する Trail Viewer バンドル。React も
  // production ビルドで配信したいので mode を production に固定する
  // (extension.js とは別ターゲット)。
  mode: 'production',
  entry: './src/trail/standalone/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'trailstandalone.js',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules[\\/](?!@anytime-markdown[\\/](?:graph-core|trail-core|trail-viewer))/,
        use: [{
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.trail-standalone.json',
            allowTsInNodeModules: true,
            transpileOnly: true,
          },
        }],
      },
    ],
  },
  plugins: [
    // process.env.NODE_ENV は webpack の mode から自動設定されるため明示不要
    new webpack.DefinePlugin({
      'process.env.NEXT_PUBLIC_SHOW_UNLIMITED': JSON.stringify('1'),
    }),
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
    new webpack.NormalModuleReplacementPlugin(/^node:path$/, require.resolve('./src/shims/empty.js')),
  ],
  // 単発で配信する Trail Viewer バンドル。code splitting の対象ではないため
  // webpack デフォルトの 244 KiB 閾値による perf hint は無効化する。
  performance: { hints: false },
  devtool: 'nosources-source-map',
};

/** @type WebpackConfig */
const mcpTrailServerConfig = {
  target: 'node',
  mode: 'development',
  entry: './src/server/mcp-trail-entry.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'mcp-trail-server.js',
    libraryTarget: 'commonjs2',
  },
  // mcp-trail サーバーは Node プロセスとして子プロセス起動するため
  // vscode API を参照しない。すべての依存をバンドルに含める。
  externals: {},
  resolve: {
    extensions: ['.ts', '.js'],
    // mcp-trail は ESM 規約 (NodeNext) で書かれており import 文に .js 拡張子が
    // 含まれる ('./client.js' 等)。webpack に対して .js を .ts として解決する
    // よう extensionAlias で指示する。
    extensionAlias: {
      '.js': ['.ts', '.js'],
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules[\\/](?!@anytime-markdown[\\/]mcp-trail)/,
        use: [{
          loader: 'ts-loader',
          options: {
            allowTsInNodeModules: true,
            transpileOnly: true,
          },
        }],
      },
    ],
  },
  devtool: 'nosources-source-map',
};

module.exports = [extensionConfig, trailStandaloneConfig, mcpTrailServerConfig];
