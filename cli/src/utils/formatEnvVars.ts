import { isObject, mapValues } from "lodash";

export default (envVars = {}) => {
  return mapValues(envVars, value =>
    isObject(value) ? JSON.stringify(value) : `${value}`
  );
};
