

FROM node:22

RUN rm /bin/sh && \
    ln -s /bin/bash /bin/sh && \
    mkdir -p /root/.nvm

# set high timeout for yarn, see https://github.com/dhis2/notes/issues/29
RUN yarn config set network-timeout 600000 -g

# pnpm for projects using it (pnpm self-switches to the version pinned
# in the project's packageManager field)
RUN npm install -g pnpm

# nvm + the current LTS line-up pre-installed. Pre-installed versions
# are only a cache: jobs with an .nvmrc switch via nvm (installing at
# job runtime when the version is not pre-installed), jobs without one
# run on the base image's node.
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash && \
    source /root/.nvm/nvm.sh && \
    chmod +x /root/.nvm/nvm.sh && \
    /root/.nvm/nvm.sh install 20 && \
    /root/.nvm/nvm.sh install 22 && \
    /root/.nvm/nvm.sh install 24
