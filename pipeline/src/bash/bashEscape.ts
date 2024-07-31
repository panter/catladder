import { registerGlobalScriptFunction } from "../globalScriptFunctions";
import type { VariableValue } from "../variables/VariableValue";
import { VariableValueContainingReferences } from "../variables/VariableValueContainingReferences";
import { BashExpression } from "./BashExpression";

export type QuotesEscapeMode = "single" | "double";

export type EscapeOptions = {
  quotes?: QuotesEscapeMode | false;
};
/**
 * escapes a string or bash expression for bash
 * it either can escape single or double quotes (double is default)
 */
export const bashEscape = (
  value: VariableValue | any,
  options: EscapeOptions = {
    quotes: "double",
  },
) => {
  if (value instanceof BashExpression) {
    // no need to escape
    return escapeBashExpression(value, options);
  }
  if (value instanceof VariableValueContainingReferences) {
    return value.toString(options);
  }
  return escapeString(value, options);
};

export const escapeString = (
  value: string | null | undefined,
  { quotes }: EscapeOptions = {
    quotes: "double",
  },
) => {
  const quoteEscaped = quotes
    ? quotes === "single"
      ? escapeSingleQuotes(value)
      : escapeDoubleQuotes(value)
    : value;

  return quoteEscaped;
};

export const escapeBashExpression = (
  value: BashExpression,
  options: EscapeOptions,
) => {
  // no need to escape, we just return the string
  return value;
};

export const escapeDoubleQuotes = (value: string | null | undefined) =>
  value?.toString().replace(/"/g, '\\"');

export const escapeSingleQuotes = (value: string | null | undefined) =>
  value?.toString().replace(/'/g, "\\'");

/**
 *
 * what an absolute nightmare.
 * unfortunatly, dotenv has many limitations. You can't escape quotes properly.
 *
 * In order to be very forgiving, we need to do some magic here:
 *
 * - when the value contains no newlines, we are fine
 * - if the value contains newlines, we need to wrap it in quotes. And thats where the problem begins:
 * - you can't escape quotes. this is a shitty limitation of dotenv and node
 * - you can have inner quotes, but they break in node.js (not in dotenv though), see https://github.com/nodejs/node/issues/54134
 * - so we need to quote cleverly
 * - to make things worse, we need to check whether we have a simple stirng or a bash expression, that needs to be evalulated first...
 */
export const escapeForDotEnv = (
  value: VariableValue | undefined | null,
): string => {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    // if string contains newlines, we need to wrap it in quotes
    // we additionaly escape newlines, that give best compatibility
    if (value.includes("\n")) {
      const newlinesReplaces = value.replace(/\n/g, "\\n");

      // default to ", but if this is not possible, we try to use ' or `
      const quote = value.includes(`"`)
        ? value.includes(`'`)
          ? value.includes("`")
            ? // If all quote types are present, default to no
              ""
            : "`"
          : "'"
        : '"';

      // if we found a quote, we can wrap the string in it
      return `${quote}${newlinesReplaces}${quote}`;
    } else {
      // otherwise we can return as is
      return value;
    }
  } else if (value instanceof BashExpression) {
    return escapeBashExpressionForDotEnv(value);
  } else if (value instanceof VariableValueContainingReferences) {
    // instead of doing it part-wise, we just do it all at once

    const containsAnyBashExpression = value.parts.some(
      (part) => part instanceof BashExpression,
    );
    if (!containsAnyBashExpression) {
      return escapeForDotEnv(
        value.toString({
          quotes: "double",
        }),
      );
    } else {
      const result = escapeBashExpressionForDotEnv(
        new BashExpression(
          value.toString({
            quotes: "double",
          }),
        ),
      );

      return result;
    }
  } else {
    return value;
  }
};
// basically the same thing as above for bash
// thx chatgpt for this
const escapeForDotEnvScript = registerGlobalScriptFunction(
  "escapeForDotEnv",
  `
 input="\${1:-$(cat)}"
 input="\${input//$'\\n'/\\\\n}"
  if [[ "$input" == *\\\\n* ]]; then
    if [[ "$input" == *\\"* && "$input" == *\\'* && "$input" == *\\\`* ]]; then
      printf "%s\\n" "$input"
    elif [[ "$input" == *\\"* && "$input" == *\\'* ]]; then
      printf "\`%s\`\\n" "$input"
    elif [[ "$input" == *\\"* ]]; then
      printf "'%s'\\n" "$input"
    else
      printf "\\"%s\\"\\n" "$input"
    fi
  else
    printf "%s\\n" "$input"
  fi
  `,
);

const escapeBashExpressionForDotEnv = (value: BashExpression) => {
  return value.transformWithCommand(escapeForDotEnvScript.name).toString();
};
