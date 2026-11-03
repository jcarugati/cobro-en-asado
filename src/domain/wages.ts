export const WAGES = [
  { key: "general", code: "0", description: "Nivel general", label: "Salarios" },
  { key: "privado", code: "110", description: "Sector privado registrado", label: "Privados registrados" },
  { key: "publico", code: "120", description: "Sector público", label: "Públicos" },
  { key: "noRegistrado", code: "200", description: "Total no registrado", label: "No registrados" },
] as const;

export type WageKey = (typeof WAGES)[number]["key"];
