// The format registry — every base template the Plant can press.
// P1 ships the collector case only; cassette + vinyl arrive in P2
// ("one of each world", owner call 2026-07-18), jewel case in P3,
// 8-track in P4. New formats should be descriptor-only additions.

import type { TemplateDescriptor } from "../types";
import { COLLECTOR_CASE } from "./collectorCase";
import { CASSETTE } from "./cassette";
import { makeVinyl } from "./vinyl";

export const TEMPLATES: Record<string, TemplateDescriptor> = {
  [COLLECTOR_CASE.id]: COLLECTOR_CASE,
  [CASSETTE.id]: CASSETTE,
  "vinyl-12": makeVinyl(12),
  "vinyl-10": makeVinyl(10),
  "vinyl-7": makeVinyl(7),
};

export const getTemplate = (id: string): TemplateDescriptor => TEMPLATES[id] ?? COLLECTOR_CASE;
export const templateList = (): TemplateDescriptor[] => Object.values(TEMPLATES);
