const UNIT_SECONDS: Record<string, number> = {
  s: 1,
  sec: 1,
  secs: 1,
  second: 1,
  seconds: 1,
  m: 60,
  min: 60,
  mins: 60,
  minute: 60,
  minutes: 60,
  h: 3600,
  hr: 3600,
  hrs: 3600,
  hour: 3600,
  hours: 3600,
  d: 86400,
  day: 86400,
  days: 86400,
  w: 604800,
  week: 604800,
  weeks: 604800,
};

const PART = /(\d+)\s*([a-z]+)/gy;

/**
 * parses a GitLab-style duration (`"10m"`, `"1h 30m"`, `"90 minutes"`)
 * into whole minutes, rounded up, with a minimum of 1.
 *
 * Bare numbers are rejected on purpose: their unit would be ambiguous.
 *
 * @throws if the value is not a valid duration; the message names the job
 */
export const parseDurationToMinutes = (
  value: string,
  jobName: string,
): number => {
  const invalid = () =>
    new Error(
      `job "${jobName}": invalid timeout "${value}". Use a duration with units like "10m", "1h 30m" or "90 minutes".`,
    );
  if (typeof value !== "string") throw invalid();
  const input = value.trim().toLowerCase();
  if (input === "") throw invalid();

  let seconds = 0;
  let pos = 0;
  PART.lastIndex = 0;
  while (pos < input.length) {
    PART.lastIndex = pos;
    const match = PART.exec(input);
    if (!match) throw invalid();
    const unit = UNIT_SECONDS[match[2]];
    if (unit === undefined) throw invalid();
    seconds += Number(match[1]) * unit;
    pos = PART.lastIndex;
    while (input[pos] === " ") pos++;
  }
  return Math.max(1, Math.ceil(seconds / 60));
};
