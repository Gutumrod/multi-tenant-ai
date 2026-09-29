/**
 * Type declarations for web/assets/i18n.js, so the reference server
 * (server/src/lib/web-pages.ts) can render the page shell from the very same
 * dictionary the browser uses.
 *
 * Resolution note: the server imports this module as `.../i18n.js` (the ESM
 * specifier the browser also uses); TypeScript maps that specifier to this
 * declaration file, which is why no tsconfig change (allowJs) is needed.
 *
 * Only the members the server consumes are declared: the dictionary tables,
 * the locale list and the locale helpers.
 */

export type Locale = 'th' | 'en';

export declare const LOCALES: Locale[];
export declare const DEFAULT_LOCALE: Locale;
export declare const STORAGE_KEY: string;
export declare const ACCOUNT_STORAGE_KEY: string;
export declare const PLAN_IDS: string[];

export declare const DICT: Record<Locale, Record<string, string>>;

export declare function isLocale(value: unknown): value is Locale;
export declare function readStoredLocale(): string | null;
export declare function resolveLocale(options?: {
  search?: string;
  stored?: string | null;
  fallback?: string | null;
}): Locale;
export declare function lookup(key: string, locale: string): string | null;
export declare function t(key: string, locale: string): string;
export declare function formatTemplate(template: string, params?: Record<string, unknown>): string;
export declare function tFormat(key: string, locale: string, params?: Record<string, unknown>): string;
export declare function applyI18n(locale: string, root?: ParentNode | null): void;
export declare function initI18n(): Locale;
