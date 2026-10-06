/** Tailwind breakpoints (module 112726). Mirrors `--breakpoint-*` in globals.css. */
export const screens = { sm: '40rem', md: '48rem', lg: '64rem', xl: '80rem', '2xl': '96rem' } as const;

export type Screen = keyof typeof screens;
