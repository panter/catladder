export const PIPELINE_IMAGE_TAG =
  process.env.INLINE_PIPELINE_IMAGE_TAG || "latest";
export const DOCKER_REGISTRY =
  process.env.INLINE_DOCKER_REGISTRY ||
  "git.panter.ch:5001/catladder/catladder";
