import { existsSync, readFileSync } from "fs";
import { join } from "path";

export const GENERATED_CATCI_FOLDER = ".catladder-generated/catci";

/**
 * the ncc-bundled catci (catladder's CI companion), shipped with the
 * package. Built by the cli workspace (`scripts/bundle`); pipeline
 * generation materializes it into `.catladder-generated/catci/` so CI
 * jobs (e.g. the release job's security audit) can run it with plain
 * `node` — no install step, no catladder baked into job images, and
 * always the exact version that generated the pipeline.
 */
const getShippedCatciBundle = (): string => {
  const candidates = [
    // ncc bundle (what consumers run): dist/bundles/<entry> -> dist/bundles/catci
    join(__dirname, "..", "catci", "index.js"),
    // cli tsc dist (catenv-dev): dist/packages/pipeline/src/catci -> dist/bundles/catci
    join(__dirname, "..", "..", "..", "..", "bundles", "catci", "index.js"),
    // repository (packages/pipeline/src/catci): <root>/apps/cli/dist/bundles/catci
    join(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "apps",
      "cli",
      "dist",
      "bundles",
      "catci",
      "index.js",
    ),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(
      "shipped catci bundle not found — run a full catladder build (`yarn build`) first",
    );
  }
  return found;
};

/**
 * the catci files to materialize into the generated folder
 */
export const getCatciGeneratedFiles = (): Array<{
  path: string;
  content: string;
}> => [
  {
    path: join(GENERATED_CATCI_FOLDER, "index.js"),
    content: readFileSync(getShippedCatciBundle(), "utf-8"),
  },
  {
    // the bundle is commonjs (ncc output using `__dirname`), but node
    // resolves the module format from the nearest package.json: a
    // consumer whose root package.json declares `"type": "module"`
    // would parse the bundle as ESM and crash on the first `__dirname`.
    // a sibling package.json pins the folder to commonjs regardless.
    path: join(GENERATED_CATCI_FOLDER, "package.json"),
    content: `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`,
  },
];
