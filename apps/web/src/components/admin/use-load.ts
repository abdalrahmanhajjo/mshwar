"use client";

import * as React from "react";

/** Load once per key; `reload` asks again. Errors show as a failed state, never as empty data. */
export function useLoad<T>(load: () => Promise<T>, key: string) {
  const [state, setState] = React.useState<{ key: string; data?: T; failed?: boolean } | null>(null);
  const [version, setVersion] = React.useState(0);
  const full = `${key}:${version}`;
  React.useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => !cancelled && setState({ key: full, data }))
      .catch(() => !cancelled && setState({ key: full, failed: true }));
    return () => {
      cancelled = true;
    };
    // `load` is rebuilt every render; the key says when to ask again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full]);
  // While the same query reloads, what it showed stays on screen; a different query starts empty.
  const current = state && (state.key === full || state.key.startsWith(`${key}:`)) ? state : null;
  return {
    data: current?.data,
    failed: current?.failed ?? false,
    loading: state?.key !== full,
    reload: () => setVersion((value) => value + 1),
  };
}
