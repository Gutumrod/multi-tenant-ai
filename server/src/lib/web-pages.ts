/**
 * Static page serving for the HOUSE-SWARM-7 WU-4 sample UI.
 *
 * Two responsibilities:
 *
 *   1. Render the shared page shell (header, navigation, language switch,
 *      footer) from the very same dictionary the browser uses
 *      (web/assets/i18n.js), for the locale the request asked for.
 *   2. Hold the small route map so `/plans` and `/app` resolve to the `.html`
 *      files, plus a read-only plan catalogue for the sample UI.
 *
 * The pages themselves stay static: `web/*.html` carries only `data-i18n`
 * attribute keys and placeholder `[key]` fallbacks, and the marker
 * `<!--{{shell}}-->` marks the slot the server fills. No visible sentence lives
 * in a page file.
 *
 * Locale resolution for a request: `?lang=th|en`, else the default locale.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DICT, LOCALES, DEFAULT_LOCALE, isLocale } from '../../../web/assets/i18n.js';
import { subscriptionCore, planRepository } from './subscriptions.js';
import type { Plan } from '../../../modules/subscription/core/types.js';

const here = dirname(fileURLToPath(import.meta.url));
export const WEB_ROOT = join(here, '../../../web');

const SHELL_MARKER = '<!--{{shell}}-->';
const PAGE_FILES = ['index.html', 'signup.html', 'login.html', 'plans.html', 'app.html'];

export interface PageRoute {
  urlPath: string;
  file: string;
}

/** The route map: URL path -> page file. */
export const PAGE_ROUTES: PageRoute[] = [
  { urlPath: '/', file: 'index.html' },
  { urlPath: '/index.html', file: 'index.html' },
  { urlPath: '/signup', file: 'signup.html' },
  { urlPath: '/signup.html', file: 'signup.html' },
  { urlPath: '/login', file: 'login.html' },
  { urlPath: '/login.html', file: 'login.html' },
  { urlPath: '/plans', file: 'plans.html' },
  { urlPath: '/plans.html', file: 'plans.html' },
  { urlPath: '/app', file: 'app.html' },
  { urlPath: '/app.html', file: 'app.html' },
];

/** Navigation entries: page file -> dictionary key for the link label. */
const NAV_ENTRIES: { file: string; labelKey: string }[] = [
  { file: 'index.html', labelKey: 'nav.home' },
  { file: 'signup.html', labelKey: 'nav.signup' },
  { file: 'login.html', labelKey: 'nav.login' },
  { file: 'plans.html', labelKey: 'nav.plans' },
  { file: 'app.html', labelKey: 'nav.app' },
];

const dictionaries = DICT as unknown as Record<string, Record<string, string>>;

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Escaped dictionary string; an unknown key renders as a visible marker. */
function esc(key: string, locale: string): string {
  const table = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
  const value = Object.prototype.hasOwnProperty.call(table, key) ? table[key] : `[${key}]`;
  return escapeHtml(value);
}

/** The `.html` link for a page file, keeping the locale in the URL. */
function pageHref(file: string, locale: string): string {
  const slug = file === 'index.html' ? '/' : `/${file.replace(/\.html$/, '')}`;
  return `${slug}?lang=${locale}`;
}

/**
 * Builds the shared shell for `activeFile`. The language switch links are
 * `?lang=` links, so the choice works without JavaScript and is also written to
 * localStorage by the browser script.
 */
export function renderShell(activeFile: string, locale: string): string {
  const nav = NAV_ENTRIES.map(({ file, labelKey }) => {
    const current = file === activeFile ? ' aria-current="page"' : '';
    return `        <a href="${pageHref(file, locale)}"${current} data-i18n="${labelKey}">[${labelKey}]</a>`;
  }).join('\n');

  const localeLinks = LOCALES.map((code) => {
    const current = code === locale ? ' aria-current="true"' : '';
    const labelKey = `lang.${code}`;
    return `        <a href="?lang=${code}" data-locale-option="${code}"${current} data-i18n="${labelKey}">[${labelKey}]</a>`;
  }).join('\n');

  return `    <div class="site-header__inner">
      <a class="brand" href="${pageHref('index.html', locale)}" data-i18n="site.title">[site.title]</a>
      <nav class="site-nav" data-role="site-nav">
${nav}
      </nav>
      <div class="langswitch">
        <span class="langswitch__label" data-i18n="lang.label">[lang.label]</span>
${localeLinks}
      </div>
    </div>`;
}

/** The footer shell. The demo-mode tag is a literal on purpose: it reports a
 *  server-side flag, not a translated sentence, and both locales read it the
 *  same way. */
function renderFooter(): string {
  const enabled = process.env.DEMO_AUTH === 'true';
  return `    <div class="site-footer__inner">
      <p data-i18n="footer.note">[footer.note]</p>
      <p><span class="tag" data-role="demo-auth-flag">DEMO_AUTH ${enabled ? 'on' : 'off'}</span></p>
    </div>`;
}

/**
 * Reads a page file and returns it with the shell filled in and every `[key]`
 * placeholder replaced by the locale's dictionary string.
 *
 * This is the same substitution the browser performs, minus the DOM: the page
 * file carries the key in a `data-i18n` attribute and the placeholder `[key]` is
 * only the no-JavaScript fallback, so the served HTML is readable in either
 * locale without any script running. The client still rewrites every visible
 * string when the persisted locale disagrees with the one served.
 *
 * The page file's own `data-locale` attribute is overwritten with the request's
 * locale.
 */
export function renderPage(file: string, locale: string): string {
  const source = readFileSync(join(WEB_ROOT, file), 'utf8');
  if (!source.includes(SHELL_MARKER)) {
    throw new Error(`page template ${file} is missing the shell marker`);
  }

  const filled = source
    .replace(
      `<header class="site-header" data-include="header">${SHELL_MARKER}</header>`,
      `<header class="site-header" data-include="header">\n${renderShell(file, locale)}\n    </header>`
    )
    .replace(
      `<footer class="site-footer" data-include="footer">${SHELL_MARKER}</footer>`,
      `<footer class="site-footer" data-include="footer">\n${renderFooter()}\n    </footer>`
    )
    .replace(/<html lang="[^"]*" data-locale="[^"]*">/, `<html lang="${locale}" data-locale="${locale}">`);

  // Every `[key]` placeholder becomes the escaped dictionary string. An unknown
  // key is left visible as `[key]` rather than silently emptied.
  return filled.replace(/\[([A-Za-z0-9._-]+)\]/g, (match, key: string) => {
    const table = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
    if (!Object.prototype.hasOwnProperty.call(table, key)) return match;
    return escapeHtml(table[key]);
  });
}

/** The locale a request asked for: `?lang=`, else the dictionary default. */
export function requestLocale(query: unknown): string {
  const value = (query as Record<string, unknown> | undefined)?.lang;
  return typeof value === 'string' && isLocale(value) ? value : DEFAULT_LOCALE;
}

/** True when every page template is present and carries the shell marker. */
export function pageFilesAvailable(): boolean {
  try {
    return PAGE_FILES.every((file) => {
      const path = join(WEB_ROOT, file);
      return existsSync(path) && readFileSync(path, 'utf8').includes(SHELL_MARKER);
    });
  } catch {
    return false;
  }
}

export interface PlanSummary {
  id: string;
  name: string;
  billingInterval?: string;
  priceMinorUnits?: number;
  currency?: string;
  entitlements: Record<string, unknown>;
}

/**
 * The plan catalogue the sample UI shows, read through the same plan repository
 * the subscription core resolves entitlements from, so the numbers on the screen
 * are the repository's own and cannot drift from what the paid routes enforce.
 * Throws (rather than inventing a catalogue) when the repository cannot be read.
 */
export async function listPlansForUi(): Promise<PlanSummary[]> {
  const plans: Plan[] = await planRepository.listAll();
  return plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    billingInterval: plan.billingInterval,
    priceMinorUnits: plan.priceMinorUnits,
    currency: plan.currency,
    entitlements: { ...plan.entitlements },
  }));
}

export { LOCALES, DEFAULT_LOCALE, isLocale };
