---
sidebar_label: Pupeteer with Node
---

# Use pupeteer in node apps

add this to your catladder.ts

```ts title="catladder.ts"

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
