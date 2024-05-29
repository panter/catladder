# use pupeteer in node apps

add this to your catladder.ts

```typescript

build: {
    type: "node",

    docker: {
        additionsBegin: [
        `ENV PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium-browser"\
            PUPPETEER_SKIP_CHROMIUM_DOWNLOAD="true"`,
        "RUN apk add chromium",
        ],
    },
},

```
