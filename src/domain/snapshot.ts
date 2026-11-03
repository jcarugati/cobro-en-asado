import type { UnitSlug } from "./units.ts";

export type Month = string;
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
