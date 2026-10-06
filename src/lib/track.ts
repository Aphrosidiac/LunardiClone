// Module 195908. The reference forwards to umami; FF ships no analytics, so this is a no-op with
// the same signature so call sites stay unchanged.
export function track(_event?: string | ((props: Record<string, unknown>) => unknown), _data?: Record<string, unknown>): void {}
