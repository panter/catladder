import type { ScalarTag } from "yaml";
import { stringify } from "yaml";
import { BashExpression } from "./BashExpression";
import { VariableValueContainingReferences } from "../variables/VariableValueContainingReferences";

const bashExpressionType: ScalarTag = {
  tag: "",
  resolve: (str) => {
    // not really needed,but let's make typescript happy
    return new BashExpression(str);
  },
  stringify(node: any, ctx: any) {
    // we create a BLOCK_LITERAL
    // but because bash will interpret the value, it may resolve to a multiline string
    // so we need to indent every line using sed
    return (
      "|-\n" +
      ctx.indent +
      indentNewlinesInBashExpression(node.value, ctx.indent)
    );
  },

  identify: (v: any) => v instanceof BashExpression,
};

const indentNewlinesInBashExpression = (
  expression: BashExpression,
  indent: string,
) => {
  return expression.transformWithCommand(`sed '1!s/^/${indent}/'`);
};

const variableContainingReferences: ScalarTag = {
  tag: "",
  resolve: (str) => {
    // not really needed,but let's make typescript happy
    return new VariableValueContainingReferences(str);
  },
  stringify(node: any, ctx: any) {
    const value: VariableValueContainingReferences = node.value;
    const stringified = value.parts
      .map((part) =>
        part instanceof BashExpression
          ? indentNewlinesInBashExpression(part, ctx.indent)
          : // indent every new line
            part.toString().replace(/\n/g, `\n${ctx.indent}`),
      )
      .join("");
    return "|-\n" + ctx.indent + stringified;
  },

  identify: (v: any) => v instanceof VariableValueContainingReferences,
};

/***
 * creates a yaml string that can be used in bash scripts
 * it handles BashExpressions correctly so that they can be evaluated in bash
 */
export const yamlBashString = (value: any) => {
  return stringify(value, {
    defaultStringType: "BLOCK_LITERAL",
    defaultKeyType: "PLAIN",
    customTags: [bashExpressionType, variableContainingReferences],
    aliasDuplicateObjects: false,
    lineWidth: 0,
  });
};

/**
 * creates a bash script that writes a yaml string to a file
 * @param value the yaml value to write, it supports BashExpressions
 */
export const writeBashYamlToFileScript = (value: any, filename: string) => {
  return [
    `cat > ${filename} <<EOF
${yamlBashString(value)}
EOF
`,
  ];
};
