import type { CommandInstance } from "vorpal";
import type { IO } from "../core/types";

type AnyMessagesFn = (message?: any, ...optionalParams: any[]) => void;
type StringMessagesFn = (message?: string, ...optionalParams: string[]) => void;
type AnyMessageFn = (message?: any) => void;
type StringMessageFn = (message?: string) => void;
type StringMessageSpreadFn = (...message: string[]) => void;
type AnyMessageSpreadFn = (...message: any[]) => void;
type SomeKindOfLogFn =
  | AnyMessagesFn
  | StringMessagesFn
  | AnyMessageFn
  | StringMessageFn
  | StringMessageSpreadFn
  | AnyMessageSpreadFn;
type HasSomeKindOfLogMethod = { log: SomeKindOfLogFn };

/**
 * Something that has a .log method taking a string argument.
 *
 * null and undefined will fall back to console.log.
 */
export type LoggerCmdInstance =
  | CommandInstance
  | IO
  | Console
  | HasSomeKindOfLogMethod
  | null
  | undefined;

type LinesArgItem =
  | string
  | number
  | boolean
  | Date
  | RegExp
  | null
  | undefined;
type LinesArg = LinesArgItem | LinesArgItem[];

/**
 * Logs multiple lines using the log method of the provided {@link LoggerCmdInstance}.
 *
 * Line items that are `null` or `undefined` are logged as empty lines.
 *
 * @param cmd - The logger instance to use. If `null` or `undefined`, `console` will be used.
 *
 * @example
 * ```ts
 * logLines(cmd, "line 1", "line 2", null, "line 3");
 * logLines(cmd, ...linesArray); // arrays can be spread into the function
 * logLines(cmd, linesArray); // but it will flatten the plain array for convenience
 * ```
 */
export function logLines(
  cmd: LoggerCmdInstance = console,
  ...lines: LinesArg[]
) {
  for (const line of lines.flat()) {
    (cmd ?? console).log(`${line ?? ""}`);
  }
}

/**
 * Logs an error message using the log method of the provided {@link LoggerCmdInstance}.
 *
 * Line items that are `null` or `undefined` are logged as empty lines.
 *
 * @example
 * ```ts
 * logError(cmd, "Message");
 * logError(cmd, "Message", "Additional message");
 * logError(cmd, "Message", "Additional message", "Another additional message line");
 * logError(cmd, "Message", ...additionalMessages); // arrays can be spread into the function
 * logError(cmd, "Message", additionalMessages); // but it will flatten the plain array for convenience
 * ```
 */
export const logError = (
  cmd: LoggerCmdInstance = console,
  message: string,
  ...additionalMessages: LinesArg[]
) => {
  logLines(cmd, "", `[ERROR] 🙀 :${message}`);
  if (additionalMessages?.length) {
    logLines(cmd, ...additionalMessages.flat());
  }
  logLines(cmd, "");
};

/**
 * Logs a warning message using the log method of the provided {@link LoggerCmdInstance}.
 *
 * Line items that are `null` or `undefined` are logged as empty lines.
 *
 * @example
 * ```ts
 * logWarning(cmd, "Message");
 * logWarning(cmd, "Message", "Additional message");
 * logWarning(cmd, "Message", "Additional message", "Another additional message line");
 * logWarning(cmd, "Message", ...additionalMessages); // arrays can be spread into the function
 * logWarning(cmd, "Message", additionalMessages); // but it will flatten the plain array for convenience
 * ```
 */
export const logWarning = (
  cmd: LoggerCmdInstance = console,
  message: string,
  ...additionalMessages: LinesArg[]
) => {
  logLines(cmd, "", `[WARNING] ⚠️ : ${message}`);
  if (additionalMessages?.length) {
    logLines(cmd, ...additionalMessages.flat());
  }
  logLines(cmd, "");
};
