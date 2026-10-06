// Module 86888. The reference bundle inlines these as build-time constants for the client.
export const IS_CLIENT = typeof window !== 'undefined';
export const IS_DEV = process.env.NODE_ENV === 'development';
