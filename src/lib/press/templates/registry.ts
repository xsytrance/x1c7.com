// The format registry — every base template the Plant can press.
// P1 ships the collector case only; cassette + vinyl arrive in P2
// ("one of each world", owner call 2026-07-18), jewel case in P3,
// 8-track in P4. New formats should be descriptor-only additions.

import type { TemplateDescriptor } from "../types";
import { COLLECTOR_CASE } from "./collectorCase";

export const TEMPLATES: Record<string, TemplateDescriptor> = {
  [COLLECTOR_CASE.id]: COLLECTOR_CASE,
};

export const getTemplate = (id: string): TemplateDescriptor => TEMPLATES[id] ?? COLLECTOR_CASE;
export const templateList = (): TemplateDescriptor[] => Object.values(TEMPLATES);
