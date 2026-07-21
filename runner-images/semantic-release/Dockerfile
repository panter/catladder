# build context is the root directory
FROM node:lts-alpine

RUN apk add --no-cache bash git git-lfs

RUN mkdir /packages
COPY ./cli /packages/cli

# add semantic release
# NOTE: keep every plugin pinned to a major that is compatible with
# semantic-release@19 (they declare `semantic-release` as a peer dependency).
# Unpinned plugins drift to their latest major on image rebuild, which now
# requires semantic-release>=20 and fails with "plugins configuration is invalid".
RUN yarn global add \
    semantic-release@^19 \
    @semantic-release/commit-analyzer@9 \
    @semantic-release/release-notes-generator@10 \
    https://github.com/panter/git.git#b4037626cc583d3e9f7995ea0604b23730d0a22e \
    @semantic-release/changelog@6 \
    @semantic-release/gitlab@9 \
    @semantic-release/exec@6 \
    /packages/cli

RUN mkdir -p /scripts
COPY ./runner-images/semantic-release/scripts/* /scripts/
RUN chmod +x /scripts/*

ENV PATH="/scripts:${PATH}"
