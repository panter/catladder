# build context is the root directory
FROM node:16-alpine


# add git. We use it to add some additional infos about the commit
RUN apk add git

RUN mkdir /packages

COPY ./pipeline /packages/pipeline

RUN yarn global add /packages/pipeline
