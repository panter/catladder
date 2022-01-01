# build context is the root directory
FROM node:14-alpine


# add semantic release
RUN yarn global add \
    semantic-release \
    @semantic-release/commit-analyzer \
    @semantic-release/release-notes-generator \
    @semantic-release/git \
    @semantic-release/changelog \
    @semantic-release/gitlab;


RUN mkdir /packages

COPY ./pipeline /packages/pipeline
RUN cd /packages/pipeline && yarn install
RUN yarn global add /packages/pipeline
