

FROM node:16

RUN rm /bin/sh && \
    ln -s /bin/bash /bin/sh && \
    mkdir -p /root/.nvm

# set high timeout for yarn, see https://github.com/dhis2/notes/issues/29
RUN yarn config set network-timeout 600000 -g 

# install nvm && some common node versions
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.2/install.sh | bash && \
    source /root/.nvm/nvm.sh && \
    chmod +x /root/.nvm/nvm.sh && \
    /root/.nvm/nvm.sh install 10 && \
    /root/.nvm/nvm.sh install 12 && \
    /root/.nvm/nvm.sh install 14 && \
    /root/.nvm/nvm.sh install 16 && \
    /root/.nvm/nvm.sh install 18 


