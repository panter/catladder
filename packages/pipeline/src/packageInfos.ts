// we can't import the package.json directly, because the bundling process will inline it
// but the version is only set during deployement, when its already bundled
// instead we need to use require.main.path to get the path of the main module, which is actually the file in the bin
// this will point to the root package.json
let ownPkg = { version: "0.0.0" };
try {
  const path = require.main?.path + "/../package.json";

  ownPkg = require(path);
} catch (e) {
  // ignore, currently in the gitlab-includes, this doesn't work
}

export default ownPkg;
