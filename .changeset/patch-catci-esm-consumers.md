---
"catladder": patch
---

Fix `catci` crashing with `ReferenceError: __dirname is not defined in ES module scope` in projects whose root `package.json` declares `"type": "module"`. The generated `.catladder-generated/catci/` folder now carries a sibling `package.json` pinning it to CommonJS, so the release guard, security audit and npm publish jobs run again on both backends.
