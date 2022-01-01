# this runner is for default jobs (build, test)
# we might separate this further in the future

FROM node:14

RUN rm /bin/sh && \
    ln -s /bin/bash /bin/sh && \
    mkdir -p /root/.nvm

# add sources
# Google Chrome (for testing purposes)
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - && \
    sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'

# install some sources
RUN apt-get update && apt-get install -y \
    git ssh-client \
    openssl \
    curl \
    bash \
    apt-transport-https \
    ca-certificates \
    git \
    gettext-base \
    libxss1 \ 
    google-chrome-stable



# set high timeout for yarn, see https://github.com/dhis2/notes/issues/29
RUN yarn config set network-timeout 600000 -g 

# install nvm && some common node versions
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash && \
    source /root/.nvm/nvm.sh && \
    chmod +x /root/.nvm/nvm.sh && \
    /root/.nvm/nvm.sh install 10 && \
    /root/.nvm/nvm.sh install 12 && \
    /root/.nvm/nvm.sh install 14 && \
    /root/.nvm/nvm.sh install 16

# add meteor (used by some apps)
RUN curl https://install.meteor.com/ | sh


RUN mkdir p /scripts
COPY ./scripts/* /scripts/
RUN chmod +x /scripts/*

ENV PATH="/scripts:${PATH}"

