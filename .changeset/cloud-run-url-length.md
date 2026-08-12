---
"catladder": patch
---

Cloud Run: keep the generated url resolvable by shortening long service names.

`ROOT_URL`/`ROOT_URL_INTERNAL` for a cloud run service are its deterministic url
`https://<service>-<projectNumber>.<region>.run.app`. Cloud run only serves that
url while the hostname's first dns label — service name plus project number —
stays within the 63 characters dns allows; past that it falls back to a legacy
url built from a random identifier that cannot be computed in advance.

Until now catladder generated the deterministic url regardless, so a component
whose name pushed the label over 63 characters got a hostname that can never
resolve, with no warning at generation time. Anything consuming it failed with
an opaque dns error — a cloud tasks queue targeting such a service retried
forever with `HTTP status code 0`.

The component part of the service name is now shortened just enough to fit. The
env and review slug parts stay intact, and names that already fit are never
touched, so existing deployments keep their names and generated output is
unchanged for them. Because review environments resolve their slug at runtime
(`mr<iid>`/`pr<number>`), 8 characters are reserved for it — a name can
therefore fit `dev`/`prod` and still be shortened for `review`.

Two cases fail generation with a clear error instead of being shortened: when
two components would end up with the same service name, and when the fixed
parts (customerName, appName, env, project number) already leave no usable room
for the component name.
