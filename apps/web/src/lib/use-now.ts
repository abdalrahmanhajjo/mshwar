import * as React from "react";

/** The time the component first rendered. Stable across re-renders, so render stays pure. */
export function useNow(): number {
  const [now] = React.useState(() => Date.now());
  return now;
}
