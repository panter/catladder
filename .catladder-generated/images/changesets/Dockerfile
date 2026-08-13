FROM node:lts-alpine

RUN apk add --no-cache bash git git-lfs

# no release tooling baked in: the changesets release logic lives in
# catci, which is materialized into the repository checkout
# (.catladder-generated/catci) by pipeline generation

RUN mkdir -p /scripts
COPY ./scripts/* /scripts/
RUN chmod +x /scripts/*

ENV PATH="/scripts:${PATH}"
