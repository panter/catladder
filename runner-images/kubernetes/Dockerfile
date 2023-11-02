
FROM alpine:3.15

# add bash
RUN apk add --no-cache bash curl

# kubernetes & helm
ENV KUBERNETES_VERSION 1.19.14
RUN curl -L -o /usr/bin/kubectl "https://storage.googleapis.com/kubernetes-release/release/v${KUBERNETES_VERSION}/bin/linux/amd64/kubectl" ;\
    chmod +x /usr/bin/kubectl ;\
    kubectl version --client

#  helm 3
ENV HELM_VERSION 3.10.0
RUN curl "https://get.helm.sh/helm-v${HELM_VERSION}-linux-amd64.tar.gz" | tar zx ;\
    mv linux-amd64/helm /usr/bin/helm ;\
    helm version --client


COPY ./scripts/* /scripts/
RUN chmod +x /scripts/*

ENV PATH="/scripts:${PATH}"

COPY ./helm-charts /helm-charts

COPY --from=git.panter.ch:5001/open-source/dependency-track-uploader:dtrackuploader-v0.3.0 /dtrackuploader /
