
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

# add semantic release
RUN yarn global add \
    semantic-release \
    @semantic-release/commit-analyzer \
    @semantic-release/release-notes-generator \
    @semantic-release/git \
    @semantic-release/changelog \
    @semantic-release/gitlab;

# kubernetes & helm
ENV KUBERNETES_VERSION 1.18.20
RUN curl -L -o /usr/bin/kubectl "https://storage.googleapis.com/kubernetes-release/release/v${KUBERNETES_VERSION}/bin/linux/amd64/kubectl" ;\
    chmod +x /usr/bin/kubectl ;\
    kubectl version --client

# helm 2 for legacy reasons
ENV HELM_2_VERSION 2.14.3
RUN curl "https://get.helm.sh/helm-v${HELM_2_VERSION}-linux-amd64.tar.gz" | tar zx ;\
    mv linux-amd64/helm /usr/bin/ ;\
    helm version --client
RUN cp /usr/bin/helm /usr/bin/helm2
#  helm3
ENV HELM_VERSION 3.6.3
RUN curl "https://get.helm.sh/helm-v${HELM_VERSION}-linux-amd64.tar.gz" | tar zx ;\
    mv linux-amd64/helm /usr/bin/helm3 ;\
    helm3 version --client

# install nvm && some common node versions
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash && \
    source /root/.nvm/nvm.sh && \
    chmod +x /root/.nvm/nvm.sh && \
    /root/.nvm/nvm.sh install 10 && \
    /root/.nvm/nvm.sh install 12 && \
    /root/.nvm/nvm.sh install 14 && \
    /root/.nvm/nvm.sh install 16

# add meteor (used by some apps)
# install also additional used released (should theoretically speed up ci-builds)
RUN curl https://install.meteor.com/ | sh &&  \
    meteor update --release 2.2 --allow-superuser
