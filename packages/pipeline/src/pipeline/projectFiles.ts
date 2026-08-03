import { existsSync } from "fs";

/**
 * does this path exist in the project catladder generates for?
 *
 * Trivial wrapper around `existsSync`, but in its own module so the
 * example tests can fake it: generation copies whichever package-manager
 * config files the project happens to have into the docker build
 * context, and reading the real filesystem there makes the example
 * snapshots depend on catladder's *own* repository layout.
 */
// export for mocking
export const projectFileExists = (path: string): boolean => existsSync(path);
