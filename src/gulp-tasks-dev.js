import webpack from 'webpack';
import yargs from 'yargs';
const argv = yargs.argv;
import WebpackDevServer from 'webpack-dev-server';
import gulpOpen from 'gulp-open';
import path from 'path';

import gulpOptionsBuilder from './gulp-options-builder';
import gulpTasksCore from './gulp-tasks-core';
import gulpTasksTest from './gulp-tasks-test';
import gulpTasksLinters from './gulp-tasks-linters';

export function devTasks (gulp, opts) {

  const runSequence = require('run-sequence').use(gulp);

  gulpTasksCore(gulp, opts);
  gulpTasksTest(gulp, opts);
  gulpTasksLinters(gulp, opts);

  const options = gulpOptionsBuilder(opts);

  gulp.task('dev-preprocess', (callback) => {
    if (argv.skipPreprocess) {
      callback();
    } else if (options.devPreprocess) {
      runSequence('preprocess', options.devPreprocess, callback);
    } else {
      runSequence('preprocess', callback);
    }
  });

  gulp.task('dev', ['dev-preprocess'], () => {

    let webpackConfigPath = path.resolve(
      __dirname, 'webpack.dev.config.js'
    );

    if (argv.config) {
      webpackConfigPath = path.resolve(argv.config);
    }

    const config = require(webpackConfigPath);

    const devServerConfig = {
      contentBase: options.dist,
      hot: options.devServerDisableHot ? false : true,
      inline: true,
      stats: {
        colors: true
      },
      publicPath: config.output.publicPath,
      historyApiFallback: true
    };

    if (options.watchOptions) {
      devServerConfig.watchOptions = options.watchOptions;
    }

    if (options.devServerProxy) {
      devServerConfig.proxy = options.devServerProxy;
    }

    var server = new WebpackDevServer(
      webpack(config), devServerConfig
    );
    server.use('/', (req, res, next) => {

      var acceptLanguageHeader = req.headers['accept-language'];

      if (acceptLanguageHeader) {
        var acceptedLanguages = acceptLanguageHeader.match(/[a-zA-z\-]{2,10}/g);
        if (acceptedLanguages) {
          res.cookie('languages', JSON.stringify(acceptedLanguages));
        }
      }

      if (req.url.match(/.+\/img\//)) { // img
        res.redirect(301, req.url.replace(/.*\/(img\/.*)$/, '/$1'));
      } else if (req.url.match(/\/img\//)) { // img
        next();
      } else if (req.url.match(/.+\/video\//)) { // video
        res.redirect(301, req.url.replace(/.*\/(video\/.*)$/, '/$1'));
      } else if (req.url.match(/\/video\//)) { // video
        next();
      } else if (req.url.match(/.+\/font\//)) { // font
        res.redirect(301, req.url.replace(/.*\/(font\/.*)$/, '/$1'));
      } else if (req.url.match(/\/font\//)) { // font
        next();
      } else if (req.url.match(/.+\/.*\.[^\/]*$/)) { // file
        res.redirect(301, req.url.replace(/.*\/([^\/]*)$/, '/$1'));
      } else {
        next();
      }
    });

    // Always open on all ports unless overridden
    var host = options.devServerHost || '0.0.0.0';

    server.listen(options.devServerPort || 8080, host, (err) => {
      if (err) {
        console.error('[webpack-dev-server] failed to start:', err);
      } else {
        var openHost = (host === '0.0.0.0') ? 'localhost' : host;
        console.log('[webpack-dev-server] started: opening the app in your default browser...');
        var suffix = options.publicPath ? options.publicPath + '/' : '';
        var openURL = 'http://' + openHost + ':' + options.devServerPort + '/webpack-dev-server/' + suffix;
        gulp.src(path.join(options.dist, 'index.html'))
        .pipe(gulpOpen({
          uri: openURL
        }));
      }
    });

    server.app.get('/reload', (req, res) => {
      // Tell connected browsers to reload.
      server.sockWrite(server.sockets, 'ok');
      res.sendStatus(200);
    });

    server.app.get('/invalid', (req, res) => {
      // Tell connected browsers some change is about to happen.
      server.sockWrite(server.sockets, 'invalid');
      res.sendStatus(200);
    });

  });
};

export default devTasks;