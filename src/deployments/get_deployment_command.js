import { readConfig } from '../utils/config_utils';
import deployments from './';
import { keys } from 'lodash';

export default (environment, command) => {
  const config = readConfig();
  const { deployment } = config.environments[environment];
  const { type = 'panter-meteor-classic' } = deployment || {};
  const availableCommands = keys(deployments[type]).join(', ');
  if (deployments[type]) {
    if (deployments[type][command]) {
      return deployments[type][command];
    }
    throw new Error(
      `Unkown deployment-command: ${command} in type ${type}. Available commands: ${availableCommands}`,
    );
  } else {
    throw new Error(`Unkown deployment-type: ${type}. Available commands: ${availableCommands}`);
  }
};
