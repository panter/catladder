import { version } from '../../package.json';

import { getFullGitVersion } from '../utils/git_utils';
import { readConfig } from '../utils/config_utils';


const CONFIGFILE = '.catladder.yaml';

export default (__, done) => {
  let projectConfig = 'no catladder project';
  try {
    const config = readConfig(CONFIGFILE);
    projectConfig = JSON.stringify(config, null, 2);
  } catch (e) {
    // empty
  }

  console.log(`
  catladder version: ${version}

  project version: ${getFullGitVersion()}

  project config:

  ${projectConfig}
  `);
  done(null);
};
