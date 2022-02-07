# syntax = edrevo/dockerfile-plus

INCLUDE+ ./jobs-default/Dockerfile

# add sources
# Google Chrome (for testing purposes)
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - && \
    sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'

# install some sources
# not sure if libxss1 is required
RUN apt-get update && apt-get install -y \
    libxss1 \ 
    google-chrome-stable

