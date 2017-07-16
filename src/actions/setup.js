import _ from 'lodash';
import prompt from 'prompt';
import remoteExec from 'ssh-exec';
import yaml from 'js-yaml';

import { environmentSchema } from '../configs/prompt_schemas';
import { getSshConfig, readConfig, writeConfig, createEnvSh } from '../utils/config_utils';
import { passEnvFile } from '../configs/directories';
import { version } from '../../package.json';
import { writePass, editPass, readPassYaml } from '../utils/pass_utils';
import actionTitle from '../ui/action_title';
import defaultEnv from '../configs/default_env';

const CONFIGFILE = '.catladder.yaml';


export default (environment, done) => {
  const config = readConfig(CONFIGFILE);
  prompt.start();

  actionTitle(`setting up ${environment}`);
  const passPathForEnvVars = passEnvFile({ config, environment });
  // console.log(passPathForEnvVars);
  const oldEnvConfig = _.get(config, ['environments', environment], {});
  prompt.get(environmentSchema({ ...config, environment }), (error, envConfig) => {
    // write new envConfig
    config.environments = {
      ...config.environments,
      [environment]: {
        ...oldEnvConfig, // merge with old config
        ...envConfig,
      },
    };
    writeConfig(CONFIGFILE, config);
    // update env-vars in path
    // first get current vars in path
    let envVars = readPassYaml(passPathForEnvVars);
    // if envVars do not exist yet, create new one and write to pass
    if (_.isEmpty(envVars)) {
      envVars = defaultEnv({ config, envConfig });
      writePass(passPathForEnvVars, yaml.safeDump(envVars));
    }
    // open editor to edit the en vars
    editPass(passPathForEnvVars);
    // load changed envVars and create env.sh on server
    // we create ROOT_URL always from the config
    const envSh = createEnvSh(
      { version, environment },
      {
        ...readPassYaml(passPathForEnvVars),
        ROOT_URL: envConfig.url,
      },
    );
    // create env.sh on server
    remoteExec(`echo "${envSh.replace(/"/g, '\\"')}" > ~/app/env.sh`, getSshConfig(CONFIGFILE, environment), (err) => {
      if (err) {
        throw err;
      }
      console.log('');
      console.log('~/app/env.sh has ben written on ', envConfig.host);
      done(null, `${environment} is set up, please restart server`);
    }).pipe(process.stdout);
  });
};
