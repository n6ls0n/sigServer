const fs = require('fs')
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: './src/index.tsx', // Update the entry point to src/index.ts
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js',
    },
    module: {
        rules: [
            {
                test: /\.(ts|tsx)$/, // Add a rule to handle TypeScript files
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.html$/, // Add a rule to handle HTML files
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
        extensions: ['.ts', '.js', '.tsx'], // Add TypeScript file extension to resolve
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/index.html', // Update the template path to src/index.html
        }),
    ],
    devServer: {
        hot: false,
        liveReload: true,
        watchFiles: ['src/**/*'],
        host: 'localhost',
        port: 3030,
    },
};
