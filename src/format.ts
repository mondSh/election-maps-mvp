const nf = new Intl.NumberFormat("he-IL");

/** Whole-number formatting with Hebrew locale grouping. */
export const fmt = (n: number): string => nf.format(Math.round(n));

/** Fraction (0..1) → percent string, e.g. 0.328 → "32.8%". */
export const pct = (x: number, digits = 1): string => `${(x * 100).toFixed(digits)}%`;
