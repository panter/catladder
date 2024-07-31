/**
 * this class represents a string that can be evaluated in bash scripts.
 *
 * you can do basic transforms like lowercase, but that does not return you a lowercase string, but instead an experssion represeting a lowercase string
 */
export class BashExpression {
  constructor(private value: string | BashExpression) {}
  public toJSON(): string {
    return this.toString();
  }
  public toString(): string {
    return this.value.toString();
  }

  public replace(
    searchValue: any,

    replacer: (substring: string, ...args: any[]) => string,
  ) {
    return new BashExpression(
      this.value.toString().replace(searchValue, replacer),
    );
  }

  /**
   *
   * @returns a bash expression to lowercase the string
   */
  public toLowerCase(): BashExpression {
    return this.transformWithCommand("awk '{print tolower($0)}'");
  }
  /**
   * concats a value to this one and returns a new BashExpression
   * @param value
   * @returns
   */
  public concat(...values: Array<string | BashExpression>): BashExpression {
    return new BashExpression(
      this.toString().concat(...values.map((v) => v.toString())),
    );
  }

  public transformWithCommand(command: string): BashExpression {
    return new BashExpression(
      // see https://stackoverflow.com/a/2264537
      `$(printf %s "${this.toString()}" | ${command})`,
    );
  }
}

export type StringOrBashExpression = string | BashExpression;

export const getBashVariable = (name: string) => new BashExpression(`$${name}`);

/**
 * joins bash expressions together with a joiner
 * returns a bash expression if any of the parts is a bash expression
 * returns a string otherwise
 *
 * @param parts
 * @param joiner
 * @returns
 */
export const joinBashExpressions = (
  parts: Array<StringOrBashExpression>,
  joiner = "",
): StringOrBashExpression => {
  const anyIsBashExpression = parts.some((p) => p instanceof BashExpression);
  if (anyIsBashExpression) {
    return new BashExpression(
      parts
        .map((p) => (p instanceof BashExpression ? p.toString() : p))
        .join(joiner),
    );
  } else {
    return parts.join(joiner);
  }
};
