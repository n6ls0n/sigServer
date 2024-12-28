const fs = require('fs')
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: './src/client/index.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js',
    },
    module: {
        rules: [
            {
                test: /\.(ts|tsx)$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.html$/,
                use: 'html-loader',
            },
            {
                test: /\.css$/,
                include: path.resolve(__dirname),
                use: ['style-loader', 'css-loader', 'postcss-loader'],
            },
        ],
        noParse: [/jest\.config\.js/],
    },
    resolve: {
        extensions: ['.ts', '.js', '.tsx'],
        alias: {
            'socket.io-client': 'socket.io-client/dist/socket.io.js',
        },
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/client/index.html',
            inject: 'body',
        }),
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: 'src/server/ssl_certs',
                    to: 'ssl_certs'
                },
                {
                    from: '.env',
                    to: '.'
                },
            ],
        }),
    ],
    devtool: 'source-map',
};
