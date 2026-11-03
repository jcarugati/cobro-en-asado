import type { UnitSlug } from "./units.ts";

export type Month = string;
export const MONTH_PATTERN = /^[0-9]{4}(0[1-9]|1[0-2])$/;
export type Snapshot = {
  firstMonth: Month;
  lastMonth: Month;
  prices: Record<UnitSlug, number[]>;
  ipc: number[];
  presets: {
    cbtHogar2: { month: Month; value: number };
    crianzaMenor1: { month: Month; value: number };
  };
};
