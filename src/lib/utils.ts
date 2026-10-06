// Module 979118.

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    Number.parseInt(h.substring(0, 2), 16),
    Number.parseInt(h.substring(2, 4), 16),
    Number.parseInt(h.substring(4, 6), 16),
  ];
}

/** Runs `fn` and returns its result — an expression-position IIFE. */
export function run<T>(fn: () => T): T {
  return fn();
}

/** Leading-edge throttle: calls `fn` at most once per `ms`. */
export const throttle = <A extends unknown[]>(fn: (...args: A) => void, ms: number) => {
  let last = 0;
  return (...args: A) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn(...args);
    }
  };
};
