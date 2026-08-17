import { escapeRegExp } from "lodash-es";
import type { Config } from "./types";

/**
 * pipeline-level variable holding the `auto_stop_in` of review
 * environments. Review deploy jobs reference it instead of a literal,
 * so the pin label's workflow rule can override it to `never` for the
 * whole pipeline (all components at once).
 */
export const REVIEW_AUTO_STOP_VARIABLE = "CL_REVIEW_AUTO_STOP";

export const DEFAULT_REVIEW_AUTO_STOP = "1 week";
export const DEFAULT_DEV_AUTO_STOP = "4 weeks";
export const DEFAULT_PIN_LABEL = "catladder::pin-review";

export type ResolvedAutoStopConfig = {
  review: string;
  dev: string;
  pinLabel: string | false;
};

export const getAutoStopConfig = (config: Config): ResolvedAutoStopConfig => ({
  review: config.autoStop?.review ?? DEFAULT_REVIEW_AUTO_STOP,
  dev: config.autoStop?.dev ?? DEFAULT_DEV_AUTO_STOP,
  pinLabel: config.autoStop?.pinLabel ?? DEFAULT_PIN_LABEL,
});

/**
 * matches the pin label inside `$CI_MERGE_REQUEST_LABELS`
 * (comma-separated) — anchored so `pin` never matches `no-pin`
 */
export const getPinLabelRegexSource = (pinLabel: string): string =>
  `(^|,)${escapeRegExp(pinLabel).replaceAll("/", "\\/")}(,|$)`;
