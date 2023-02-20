# build context is the root directory
FROM node:16-alpine

RUN apk add --no-cache bash git git-lfs

# add semantic release
RUN yarn global add \
    semantic-release@^19 \
    @semantic-release/commit-analyzer \
    @semantic-release/release-notes-generator \
    https://github.com/panter/git.git#b4037626cc583d3e9f7995ea0604b23730d0a22e \
    @semantic-release/changelog \
    @semantic-release/gitlab@9 \
    @semantic-release/exec;


RUN mkdir p /scripts
COPY ./scripts/* /scripts/
RUN chmod +x /scripts/*

ENV PATH="/scripts:${PATH}"

