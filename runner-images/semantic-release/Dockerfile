# build context is the root directory
FROM node:14-alpine

RUN apk add --no-cache bash git

# add semantic release
RUN yarn global add \
    semantic-release \
    @semantic-release/commit-analyzer \
    @semantic-release/release-notes-generator \
    @semantic-release/git \
    @semantic-release/changelog \
    @semantic-release/gitlab;


RUN mkdir p /scripts
COPY ./scripts/* /scripts/
RUN chmod +x /scripts/*

ENV PATH="/scripts:${PATH}"

