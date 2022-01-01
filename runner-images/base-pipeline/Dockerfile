# build context is the root directory
FROM node:14-alpine



RUN mkdir /packages

COPY ./pipeline /packages/pipeline

RUN yarn global add /packages/pipeline
