---
"catladder": minor
---

Cloud Run schedules (`execute` entries with `when: "schedule"`) accept an optional `timeZone` (IANA name, e.g. `"Europe/Zurich"`), so a scheduled job or http call keeps its local time across daylight saving changes instead of running in UTC.
