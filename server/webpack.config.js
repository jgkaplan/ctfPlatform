const webpack = require('webpack');
const path = require('path');

const BUILD_DIR = path.resolve(__dirname, 'web', 'static', 'scripts');
const APP_DIR = path.resolve(__dirname, 'web', 'react');

var config = {
    entry: {
        teamlist: './web/react/TeamList.js'
    },
    output: {
        path: BUILD_DIR,
        filename: "[name].bundle.js"
    },
    module: {
        rules: [{
            test: /\.css$/,
            use: ['style-loader', 'css-loader']
        },{
            test: /\.jsx?$/,
            loader: 'babel-loader',
            include: APP_DIR,
            query: {
                presets: [
                    'env', 'react'
                ]
            }
        }]
    }
};

module.exports = config;
