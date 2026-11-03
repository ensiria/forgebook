/**
 * The variables the app reads from `process.env`: what Next.js writes into the browser's code.
 *
 * @module
 */
/// <reference types="next" />
/// <reference types="next/image-types/global" />

declare namespace NodeJS {
  interface ProcessEnv {
    /** The harbour's name, from `next.config.ts`'s `env`. */
    readonly HARBOUR_NAME?: string;
    /** The site's address, from `.env`. */
    readonly NEXT_PUBLIC_SITE_URL?: string;
  }
}
