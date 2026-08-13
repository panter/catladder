FROM node:lts-alpine

# openssh: the release job pushes with the release deploy key over ssh
RUN apk add --no-cache bash git git-lfs openssh-client

# no release tooling baked in: the changesets release logic lives in
# catci, which is materialized into the repository checkout
# (.catladder-generated/catci) by pipeline generation

RUN mkdir -p /scripts
COPY ./scripts/* /scripts/
RUN chmod +x /scripts/*

ENV PATH="/scripts:${PATH}"
