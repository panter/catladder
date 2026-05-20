
FROM docker:29.5.1

# add bash
RUN apk add --no-cache bash 

# for glcoud
ARG GCLOUD_SDK_VERSION=448.0.0

RUN apk --update add curl python3 py3-crcmod libc6-compat
RUN curl -O https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-sdk-${GCLOUD_SDK_VERSION}-linux-x86_64.tar.gz && \
    tar zxvf google-cloud-sdk-${GCLOUD_SDK_VERSION}-linux-x86_64.tar.gz && \
    rm google-cloud-sdk-${GCLOUD_SDK_VERSION}-linux-x86_64.tar.gz && \
    ./google-cloud-sdk/install.sh
ENV PATH="/google-cloud-sdk/bin:${PATH}"

# end gcloud

# for scripts

RUN mkdir p /scripts
COPY ./scripts/* /scripts/
RUN chmod +x /scripts/*

ENV PATH="/scripts:${PATH}"

