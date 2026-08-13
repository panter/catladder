# job images are addressed by a content hash of this directory — the
# build must be reproducible, so every dependency is pinned exactly.
# node:24 satisfies the newer plugins' engine requirements
# (@semantic-release/git and @semantic-release/changelog need node >=24.15).
FROM node:24-alpine

RUN apk add --no-cache bash git git-lfs

# add semantic release
# NOTE: pin every dependency exactly. These are the semantic-release@25 line
# (all ESM — v25 loads plugins via dynamic import, so changelog@7/git@11 are
# fine). Every plugin declares `semantic-release` as a peer dependency, so a
# plugin major that outpaces the semantic-release major fails the release job
# with "plugins configuration is invalid" — bump them together. Upstream
# @semantic-release/git replaces the old panter fork; see
# scripts/semanticRelease for why the commit message is hardcoded.
RUN yarn global add \
    semantic-release@25.0.8 \
    @semantic-release/commit-analyzer@13.0.1 \
    @semantic-release/release-notes-generator@14.1.1 \
    @semantic-release/git@11.0.0 \
    @semantic-release/changelog@7.0.0 \
    @semantic-release/gitlab@13.3.3 \
    @semantic-release/exec@7.1.0

RUN mkdir -p /scripts
COPY ./scripts/* /scripts/
RUN chmod +x /scripts/*

ENV PATH="/scripts:${PATH}"
