FROM node:lts-alpine

RUN apk add --no-cache bash git

# npm trusted publishing (OIDC) needs npm >= 11.5.1; the npm bundled
# with the node image is not guaranteed to be new enough, so pin the
# major explicitly. Without it npm silently falls back to token auth.
RUN npm install -g npm@11

# no publish logic baked in: it lives in catci, which pipeline
# generation materializes into the repository checkout
# (.catladder-generated/catci)
