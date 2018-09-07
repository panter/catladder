'use strict';

var _extends = require('babel-runtime/helpers/extends')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _configsDirectories = require('../configs/directories');

var _utilsExec = require('../utils/exec');

var _utilsExec2 = _interopRequireDefault(_utilsExec);

var execInstallNpmModules = function execInstallNpmModules(_ref) {
  var config = _ref.config;

  if (config.useYarn) {
    // install yarn if not available on meteor
    (0, _utilsExec2['default'])('meteor npm install -g yarn', {
      cwd: config.appDir,
      stdio: 'inherit'
    });
  }
  (0, _utilsExec2['default'])('meteor ' + (config.useYarn ? 'yarn' : 'npm') + ' install', {
    cwd: config.appDir,
    stdio: 'inherit'
  });
};

exports['default'] = function (_ref2) {
  var config = _ref2.config;
  var environment = _ref2.environment;
  var _ref2$additionalBuildEnv = _ref2.additionalBuildEnv;
  var additionalBuildEnv = _ref2$additionalBuildEnv === undefined ? {} : _ref2$additionalBuildEnv;
  var args = arguments.length <= 1 || arguments[1] === undefined ? [] : arguments[1];

  var buildDir = (0, _configsDirectories.getBuildDir)({ config: config, environment: environment });
  var envConf = config.environments[environment];
  // read build params
  var _envConf$buildEnv = envConf.buildEnv;
  var buildEnv = _envConf$buildEnv === undefined ? {} : _envConf$buildEnv;

  var buildEnvWithAppVersions = _extends({}, additionalBuildEnv, buildEnv);
  var buildEnvString = _lodash2['default'].map(buildEnvWithAppVersions, function (value, key) {
    return key + '=\'' + value + '\'';
  }).join(' ');
  execInstallNpmModules({ config: config });
  (0, _utilsExec2['default'])(buildEnvString + ' meteor build ' + args.join(' ') + ' --architecture os.linux.x86_64 --server ' + envConf.url + ' --directory ' + buildDir, {
    cwd: config.appDir,
    stdio: 'inherit'
  });
};

module.exports = exports['default'];
//# sourceMappingURL=exec_meteor_build.js.map