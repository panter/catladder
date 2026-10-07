import type { GithubStep } from "../../types/github-types";

/**
 * Artifacts are handed between github jobs as ONE tar archive instead
 * of letting upload-artifact walk the paths itself.
 *
 * upload-artifact does not preserve symlinks (it uploads the target's
 * content) nor file modes, and it strips the paths' common ancestor.
 * Gitlab artifacts keep all of that, and builds rely on it: next.js
 * with turbopack writes `.next/node_modules/<pkg>-<hash>` as relative
 * symlinks into the pnpm virtual store. Copied as plain directories,
 * node resolves the package's own dependencies from the wrong place
 * and the app crashes with ERR_MODULE_NOT_FOUND at runtime. tar keeps
 * symlinks, modes and the paths relative to the repo root (github's
 * own docs recommend it for exactly this).
 *
 * The archive is not hidden (upload-artifact skips hidden files) and
 * lives in the workspace, the one path run steps and actions agree on
 * inside job containers too.
 */
export const artifactArchiveFile = (jobId: string) =>
  `catladder-artifacts-${jobId}.tar`;

export const createArtifactUploadSteps = (
  jobId: string,
  paths: string[],
  condition?: string,
): GithubStep[] => {
  const archive = artifactArchiveFile(jobId);
  const ifCondition = condition ? { if: condition } : {};
  return [
    {
      name: "Archive artifacts",
      ...ifCondition,
      run: [
        "shopt -s nullglob globstar",
        "paths=()",
        // unquoted on purpose: artifact paths may be globs. Non-matching
        // globs vanish (nullglob), missing literal paths are skipped —
        // gitlab only warns about both, so do we
        `for path in ${paths.join(" ")}; do`,
        '  if [ -e "$path" ] || [ -L "$path" ]; then paths+=("$path"); else echo "::warning::artifact path not found: $path"; fi',
        "done",
        "if [ ${#paths[@]} -eq 0 ]; then",
        // an empty archive keeps downstream downloads from failing.
        // Written by hand: busybox tar (alpine job images) refuses to
        // create one, and zero blocks are what an empty tar is
        `  head -c 10240 /dev/zero > ${archive}`,
        "else",
        `  tar -cf ${archive} -- "\${paths[@]}"`,
        "fi",
      ].join("\n"),
      shell: "bash",
    },
    {
      name: "Upload artifacts",
      ...ifCondition,
      uses: "actions/upload-artifact@v4",
      with: {
        name: jobId,
        path: archive,
        "if-no-files-found": "error",
      },
    },
  ];
};

export const createArtifactDownloadSteps = (
  providerIds: string[],
): GithubStep[] =>
  providerIds.length === 0
    ? []
    : [
        ...providerIds.map((id) => ({
          name: `Download artifacts from ${id}`,
          uses: "actions/download-artifact@v4",
          with: { name: id },
        })),
        {
          name: "Extract artifacts",
          run: providerIds
            .flatMap((id) => [
              `tar -xf ${artifactArchiveFile(id)}`,
              `rm ${artifactArchiveFile(id)}`,
            ])
            .join("\n"),
          shell: "bash",
        },
      ];
