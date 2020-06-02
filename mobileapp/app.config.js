// runtime app config customization
// by default expo reads app.json, but then it passes the normalized
// configuration to the function exported by this module allowing us
// to perform additional config customization at runtime (e.g. based
// on whether or not we are in testing/development/production) and
// allow us to load additional configuration that is not stored in the
// repository (e.g. service keys, etc.)
import * as fs from 'fs';

import { ArgumentParser } from 'argparse';
import Constants from 'expo-constants';


function envConfigFile(env) {
  return `./app.config.${env}.json`;
}


// The release channel determines what configuration environment we use
// As far as I can tell there is no way to determine the release channel
// except to parse it from the command line e.g. when running `expo publish`.
// If not found (e.g. with expo start) then the default release channel
// is 'dev'
function getReleaseChannel() {
  const parser = new ArgumentParser();
  parser.addArgument('--release-channel', { defaultValue: 'dev' });
  const [ args, rest ] = parser.parseKnownArgs();
  return args.release_channel;
}


function getEnvConfig(env) {
  let configFile = envConfigFile(env);
  let config = {};
  if (!fs.existsSync(configFile)) {
    if (env == 'dev') {
      console.log(
        `WARNING: ${configFile} missing; this file is optional in ` +
        `development mode but without it some functionality will not work`
      );
    } else {
      console.error(
        `${configFile} missing; this file must exist for ${env} builds`
      );
    }
  } else {
    Object.assign(config, JSON.parse(fs.readFileSync(configFile, 'utf-8')));
  }
  return config;
}


// Used to perform a deep-merge of the environment specific
// app.config.<env>.json into the main app.json
function deepAssign(target, ...sources) {
  for (let source of sources) {
    for (let k in source) {
      let sval = source[k], tval = target[k];
      if (Object(sval) === sval && Object(tval) === tval) {
        // If both values are object asign recursively
        target[k] = deepAssign(tval, sval);
      } else {
        target[k] = sval;
      }
    }
  }

  return target;
}


export default ({ config }) => {
  const env = getReleaseChannel();
  return deepAssign(config, getEnvConfig(env), {
    "extra": {
      "environment": env,
      "environmentConfig": envConfigFile(env)
    }
  });
}
