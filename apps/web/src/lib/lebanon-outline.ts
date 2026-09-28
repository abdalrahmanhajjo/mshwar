/**
 * Lebanon's outline as [lng, lat] points, simplified for a decorative preview map. It is
 * drawn as a field of dots, so the preview never loads anything from a third party.
 */
export const LEBANON_OUTLINE: [number, number][] = [
  [35.1, 33.09],
  [35.2, 33.27],
  [35.3, 33.45],
  [35.37, 33.56],
  [35.45, 33.7],
  [35.47, 33.9],
  [35.55, 33.93],
  [35.62, 33.98],
  [35.64, 34.12],
  [35.66, 34.27],
  [35.72, 34.33],
  [35.8, 34.46],
  [35.9, 34.53],
  [35.97, 34.63],
  [36.1, 34.64],
  [36.3, 34.63],
  [36.45, 34.59],
  [36.52, 34.46],
  [36.61, 34.2],
  [36.43, 34.05],
  [36.28, 33.91],
  [36.07, 33.83],
  [35.93, 33.64],
  [35.86, 33.42],
  [35.82, 33.28],
  [35.62, 33.27],
  [35.55, 33.26],
  [35.46, 33.09],
];

// Frame of the preview, a little beyond the border on every side.
const WEST = 34.95;
const EAST = 36.72;
const NORTH = 34.74;
const SOUTH = 32.99;
// Degrees of longitude are shorter than degrees of latitude at 34° N.
const LNG_SCALE = Math.cos((34 * Math.PI) / 180);
const UNIT = 400;

export const PREVIEW_WIDTH = Math.round((EAST - WEST) * LNG_SCALE * UNIT);
export const PREVIEW_HEIGHT = Math.round((NORTH - SOUTH) * UNIT);

/** A position on the preview, in its own units (0…PREVIEW_WIDTH, 0…PREVIEW_HEIGHT). */
export function project(lng: number, lat: number): { x: number; y: number } {
  return { x: (lng - WEST) * LNG_SCALE * UNIT, y: (NORTH - lat) * UNIT };
}

export function insideLebanon(lng: number, lat: number): boolean {
  let inside = false;
  LEBANON_OUTLINE.forEach(([xi, yi], i) => {
    const [xj, yj] = LEBANON_OUTLINE[(i || LEBANON_OUTLINE.length) - 1] ?? [xi, yi];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  });
  return inside;
}

/** The dot field that draws the country: a regular grid clipped to the outline. */
export function outlineDots(step = 0.034): { x: number; y: number }[] {
  const dots: { x: number; y: number }[] = [];
  for (let lat = SOUTH; lat <= NORTH; lat += step) {
    for (let lng = WEST; lng <= EAST; lng += step / LNG_SCALE) {
      if (insideLebanon(lng, lat)) dots.push(project(lng, lat));
    }
  }
  return dots;
}
