/**
 * Runtime configuration. Expo inlines `EXPO_PUBLIC_*` variables at build time,
 * so set them in `.env` (see `.env.example`) and restart the dev server.
 */

/** Base URL of the ResumeLens FastAPI backend, e.g. http://192.168.1.10:8000 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

/** With no backend configured, the app runs against in-memory demo data. */
export const USE_MOCKS = process.env.EXPO_PUBLIC_USE_MOCKS === 'true' || !API_URL;
