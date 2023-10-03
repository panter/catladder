
FROM docker:24.0.6

# add bash
RUN apk add --no-cache bash 

RUN mkdir p /scripts
COPY ./scripts/* /scripts/
RUN chmod +x /scripts/*

ENV PATH="/scripts:${PATH}"

