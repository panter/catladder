import { BashExpression, bashEscape } from "./BashExpression";

// from https://github.com/dsblv/string-replace-async/blob/main/index.js
// and adjusted a bit
export default async function replaceAsync(
  string: string | BashExpression,
  searchValue: any,
  replacer: (
    substring: string,
    ...args: any[]
  ) => Promise<string | BashExpression>,
) {
  const wasBashExpression = string instanceof BashExpression;

  try {
    // 1. Run fake pass of `replace`, collect values from `replacer` calls
    // 2. Resolve them with `Promise.all`
    // 3. Run `replace` with resolved values
    const values: Array<Promise<string | BashExpression>> = [];
    String.prototype.replace.call(
      string instanceof BashExpression ? string : bashEscape(string),
      searchValue,
      function (...args) {
        // eslint-disable-next-line prefer-spread
        const result = replacer.apply(undefined, args);
        values.push(result);
        return "";
      },
    );
    const resolvedValues = await Promise.all(values);

    const containsBashExpression = resolvedValues.some(
      (value) => value instanceof BashExpression,
    );
    const result = (
      string instanceof BashExpression ? string : bashEscape(string)
    ).replace(searchValue, function () {
      return resolvedValues.shift()?.toString() ?? "";
    });

    if (wasBashExpression || containsBashExpression) {
      return new BashExpression(result);
    } else {
      return result;
    }
  } catch (error) {
    return Promise.reject(error);
  }
}
