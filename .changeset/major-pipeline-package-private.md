---
"catladder": major
---

`@catladder/pipeline` is no longer published to npm. It was always an implementation detail compiled into the CLI; `@catladder/cli` is the only published package. Projects importing `@catladder/pipeline` directly must switch to the `@catladder/cli` exports.
