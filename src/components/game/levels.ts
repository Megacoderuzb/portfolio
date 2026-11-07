// Level maps for the footer breakout (docs/GAME.md). One string per brick row, all rows the same length.
//   r rounded rect · t triangle · d diamond · h hexagon · c circle · UPPERCASE = 2 hits · . empty
// The engine scales the grid to the canvas width and the top half of its height (280–320 px tall).

export type LevelMap = readonly string[];

export const LEVELS: readonly LevelMap[] = [
  // 1: full grid, shapes in diagonals
  ["rthdcrthdc", "thdcrthdcr", "hdcrthdcrt", "dcrthdcrth"],
  // 2: diamond / pyramid, 2-hit bricks down the middle
  [".....d.....", "....dDd....", "...dhHhd...", "..dhcDchd..", "...dhHhd...", "....dDd....", ".....d....."],
  // 3: the letters MA
  [".r...r..hhh..", ".Rr.rR.h...h.", ".r.c.r.h...h.", ".r...r.HhchH.", ".r...r.h...h.", ".R...R.h...h."],
];

export const SHAPES = { r: "rect", t: "triangle", d: "diamond", h: "hexagon", c: "circle" } as const;
export type Shape = (typeof SHAPES)[keyof typeof SHAPES];
