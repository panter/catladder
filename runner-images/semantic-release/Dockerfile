# job images are addressed by a content hash of this directory — the
# build must be reproducible, so every dependency is pinned exactly.
# (@semantic-release/changelog@7 went ESM-only and broke overnight under
# the CJS semantic-release@19 while the hash claimed "unchanged".)
FROM node:22-alpine

RUN apk add --no-cache bash git git-lfs

# add semantic release
# NOTE: keep every plugin pinned to a major that is compatible with
# semantic-release@19 (they declare `semantic-release` as a peer dependency).
# Unpinned plugins drift to their latest major on image rebuild, which now
# requires semantic-release>=20 and fails with "plugins configuration is invalid".
RUN yarn global add \
    semantic-release@19.0.5 \
    @semantic-release/commit-analyzer@13.0.1 \
    @semantic-release/release-notes-generator@14.1.1 \
    https://github.com/panter/git.git#b4037626cc583d3e9f7995ea0604b23730d0a22e \
    @semantic-release/changelog@6.0.3 \
    @semantic-release/gitlab@9.5.1 \
    @semantic-release/exec@6.0.3

RUN mkdir -p /scripts
COPY ./scripts/* /scripts/
RUN chmod +x /scripts/*

ENV PATH="/scripts:${PATH}"
