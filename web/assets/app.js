/**
 * HOUSE-SWARM-7 WU-4 sample UI behaviour.
 *
 * Scope: this file contains NO visible text. Every user-facing string is looked
 * up from the dictionary in i18n.js (see `t()` / `tFormat()`), and every server
 * response is printed from the response object itself rather than re-worded
 * here, so the refusal shapes (402 QUOTA_NOT_ENTITLED / 429 QUOTA_EXCEEDED) are
 * shown as the server returns them.
 *
 * Two HTTP headers are used:
 *   x-tenant-id    — the tenant identity the server's tenant middleware reads
 *                    (same header as the documented API).
 *   x-demo-account — the same id, only consulted by the server's demo
 *                    middleware and only when DEMO_AUTH=true.
 *
 * The page shell (header, nav, language switch, footer) is rendered by the
 * server; this script never replaces it.
 */
import {
  DEFAULT_LOCALE,
  PLAN_IDS,
  STORAGE_KEY,
  ACCOUNT_STORAGE_KEY,
  AI_FEATURE_KEY,
  applyI18n,
  formatTemplate,
  initI18n,
  isLocale,
  t,
} from './i18n.js';

const TENANT_HEADER = 'x-tenant-id';
const DEMO_ACCOUNT_HEADER = 'x-demo-account';
const TENANT_ID_MAX_LENGTH = 64;
const TENANT_ID_PATTERN = /^[A-Za-z0-9._\-@]{1,64}$/;
const DEMO_ACCOUNT_PREFIX = 'demo_account_';

const state = {
  locale: DEFAULT_LOCALE,
  accountId: null,
};

/* ------------------------------------------------------------------ helpers */

function readStoredAccount() {
  try {
    return localStorage.getItem(ACCOUNT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeAccount(accountId) {
  try {
    if (accountId) localStorage.setItem(ACCOUNT_STORAGE_KEY, accountId);
    else localStorage.removeItem(ACCOUNT_STORAGE_KEY);
  } catch {
    /* storage unavailable: the ?tenant= parameter is the fallback */
  }
}

function accountFromQuery() {
  try {
    const value = new URLSearchParams(location.search).get('tenant');
    return isValidTenantId(value) ? value : null;
  } catch {
    return null;
  }
}

function isValidTenantId(value) {
  return typeof value === 'string' && TENANT_ID_PATTERN.test(value);
}

function currentAccountId() {
  if (isValidTenantId(state.accountId)) return state.accountId;
  const stored = readStoredAccount();
  if (isValidTenantId(stored)) return stored;
  const fromQuery = accountFromQuery();
  if (isValidTenantId(fromQuery)) return fromQuery;
  return null;
}

/** The dictionary string for `key` with `{}` placeholders substituted. */
function tr(key, params) {
  return params ? formatTemplate(t(key, state.locale), params) : t(key, state.locale);
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
  return element;
}

function setStatus(selector, tone, value) {
  const element = document.querySelector(selector);
  if (!element) return null;
  element.setAttribute('data-tone', tone);
  element.textContent = value;
  return element;
}

function show(selector) {
  const element = document.querySelector(selector);
  if (element) element.hidden = false;
  return element;
}

function hide(selector) {
  const element = document.querySelector(selector);
  if (element) element.hidden = true;
  return element;
}

function requestHeaders(accountId) {
  const headers = { 'content-type': 'application/json' };
  if (accountId) {
    headers[TENANT_HEADER] = accountId;
    headers[DEMO_ACCOUNT_HEADER] = accountId;
  }
  return headers;
}

async function callJson(method, path, body, accountId) {
  const response = await fetch(path, {
    method,
    headers: requestHeaders(accountId),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return { status: response.status, ok: response.ok, payload };
}

function linkTo(page, accountId) {
  const url = new URL(page, location.href);
  url.searchParams.set('lang', state.locale);
  if (accountId) url.searchParams.set('tenant', accountId);
  return `${url.pathname}${url.search}`;
}

/** Fills the small "acting as" blocks that carry the current demo tenant id. */
function renderIdentity() {
  const accountId = currentAccountId();
  const values = document.querySelectorAll('[data-account-value]');
  for (const element of values) {
    element.textContent = accountId ?? tr('common.value_unread');
  }
  const none = document.querySelector('[data-account-none]');
  if (none) none.hidden = accountId !== null;

  for (const link of document.querySelectorAll('[data-nav-app], [data-nav-plans], [data-nav-login]')) {
    const page = link.getAttribute('data-nav-app')
      ? 'app.html'
      : link.getAttribute('data-nav-plans')
        ? 'plans.html'
        : 'login.html';
    link.setAttribute('href', linkTo(page, accountId));
  }

  for (const link of document.querySelectorAll('[data-continue]')) {
    const page = link.getAttribute('data-continue');
    if (page) link.setAttribute('href', linkTo(page, accountId));
  }

  return accountId;
}

/** Prints a server JSON body verbatim, so a refusal is shown as sent. */
function renderServerResponse(targetSelector, result) {
  const element = document.querySelector(targetSelector);
  if (!element) return;

  const body = result.payload === null ? tr('common.value_unread') : JSON.stringify(result.payload, null, 2);
  element.textContent = body;
}

/* -------------------------------------------------------------- landing page */

function initLandingPage() {
  renderIdentity();
}

/* --------------------------------------------------------------- signup page */

function initSignupPage() {
  const input = document.querySelector('#tenant-id');
  const generated = `${DEMO_ACCOUNT_PREFIX}${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  if (input && !input.value) input.value = currentAccountId() ?? generated;
  renderIdentity();

  const generateButton = document.querySelector('[data-action="generate-id"]');
  if (generateButton && input) {
    generateButton.addEventListener('click', () => {
      input.value = `${DEMO_ACCOUNT_PREFIX}${Date.now().toString(36)}${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      input.focus();
    });
  }

  const form = document.querySelector('[data-form="signup"]');
  if (form && input) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = input.value.trim();
      if (!isValidTenantId(value)) {
        setStatus('[data-status="signup"]', 'refused', tr('signup.tenant.help'));
        return;
      }
      state.accountId = value;
      storeAccount(value);
      location.href = linkTo('plans.html', value);
    });
  }

  // The plan catalogue is read from the server's plan repository and rendered
  // here without a select button: this screen creates no account and no
  // subscription, it only shows what the server has.
  const plans = await fetchPlans();
  if (plans) {
    renderPlanTable(plans, { target: '[data-role="plan-rows-signup"]', withAction: false });
    show('[data-panel="plan-table"]');
  } else {
    hide('[data-panel="plan-table"]');
    show('[data-panel="plans-unavailable"]');
  }
}

/* ---------------------------------------------------------------- login page */

function initLoginPage() {
  const input = document.querySelector('#tenant-id');
  if (input && !input.value) input.value = currentAccountId() ?? '';
  renderIdentity();

  const form = document.querySelector('[data-form="login"]');
  if (form && input) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = input.value.trim();
      if (!isValidTenantId(value)) {
        setStatus('[data-status="login"]', 'refused', tr('signup.tenant.help'));
        return;
      }
      state.accountId = value;
      storeAccount(value);
      location.href = linkTo('app.html', value);
    });
  }
}

/* ---------------------------------------------------------------- plans page */

function planDisplayName(plan) {
  const key = `plan.${plan.id}.display`;
  const translated = t(key, state.locale);
  // Falls back to the plan's own database name when the plan is not one this
  // dictionary labels; the database name is data, not prose.
  return translated === `[${key}]` ? String(plan.name ?? plan.id) : translated;
}

function formatPrice(plan) {
  if (typeof plan.priceMinorUnits !== 'number') return tr('common.value_unread');
  const amount = (plan.priceMinorUnits / 100).toFixed(2);
  const currency = plan.currency ? String(plan.currency) : '';
  const perMonth = plan.billingInterval === 'month' ? ` ${tr('plans.per_month')}` : '';
  return `${amount} ${currency}${perMonth}`.trim();
}

function entitlementCell(value) {
  if (value === null || value === undefined) return tr('common.value_unlimited');
  return String(value);
}

function renderPlanTable(plans, options = {}) {
  const withAction = options.withAction !== false;
  const target = document.querySelector(options.target ?? '[data-role="plan-rows"]');
  if (!target) return;
  target.textContent = '';

  for (const plan of plans) {
    const row = document.createElement('tr');

    const nameCell = document.createElement('td');
    if (withAction) {
      const nameStrong = document.createElement('strong');
      nameStrong.textContent = planDisplayName(plan);
      nameCell.appendChild(nameStrong);
    } else {
      nameCell.textContent = planDisplayName(plan);
    }

    const idCell = document.createElement('td');
    idCell.className = 'mono';
    idCell.textContent = String(plan.id ?? '');

    const dbNameCell = document.createElement('td');
    dbNameCell.textContent = String(plan.name ?? '');

    const priceCell = document.createElement('td');
    priceCell.className = 'mono';
    priceCell.textContent = formatPrice(plan);

    const aiCell = document.createElement('td');
    aiCell.className = 'mono';
    aiCell.textContent = entitlementCell(plan.entitlements?.['ai_requests_per_month']);

    const paymentsCell = document.createElement('td');
    paymentsCell.className = 'mono';
    paymentsCell.textContent = entitlementCell(plan.entitlements?.['payments_per_month']);

    row.append(nameCell, idCell, dbNameCell, priceCell, aiCell, paymentsCell);

    if (withAction) {
      const actionCell = document.createElement('td');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn--small';
      button.textContent = tr('plans.select');
      button.addEventListener('click', () => selectPlan(String(plan.id)));
      actionCell.appendChild(button);
      row.appendChild(actionCell);
    }

    target.appendChild(row);
  }
}

/** Reads the plan catalogue from the server (public read-only route). */
async function fetchPlans() {
  try {
    const result = await callJson('GET', '/ui/plans.json', undefined, undefined);
    const plans = Array.isArray(result.payload?.plans) ? result.payload.plans : null;
    return result.ok && plans ? plans : null;
  } catch {
    return null;
  }
}

async function selectPlan(planId) {
  const accountId = currentAccountId();
  if (!accountId) {
    setStatus('[data-status="plans"]', 'refused', tr('app.errors.missing_identity'));
    return;
  }

  setStatus('[data-status="plans"]', 'plain', tr('plans.status.working'));
  hide('[data-panel="plans-refusal"]');

  let result;
  try {
    result = await callJson('POST', '/subscription/subscribe', { planId }, accountId);
  } catch {
    setStatus('[data-status="plans"]', 'refused', tr('app.errors.network'));
    return;
  }

  if (result.status === 201) {
    setStatus('[data-status="plans"]', 'ok', tr('plans.status.created'));
    location.href = linkTo('app.html', accountId);
    return;
  }

  if (result.status === 409) {
    setStatus('[data-status="plans"]', 'warn', tr('plans.status.exists'));
    location.href = linkTo('app.html', accountId);
    return;
  }

  setStatus('[data-status="plans"]', 'refused', tr('plans.status.error'));
  show('[data-panel="plans-refusal"]');
  setText('[data-role="plans-refusal-status"]', String(result.status));
  renderServerResponse('[data-role="plans-refusal-body"]', result);
}

async function initPlansPage() {
  renderIdentity();

  const plans = await fetchPlans();
  if (!plans) {
    hide('[data-panel="plan-table"]');
    show('[data-panel="plans-unavailable"]');
    setStatus('[data-status="plans"]', 'refused', tr('plans.nodb.title'));
    return;
  }

  renderPlanTable(plans, { target: '[data-role="plan-rows"]', withAction: true });
  show('[data-panel="plan-table"]');
  hide('[data-panel="plans-unavailable"]');
  setStatus('[data-status="plans"]', 'plain', tr('plans.status.idle'));
}

/* ------------------------------------------------------------------ app page */

const quota = {
  planId: null,
  limit: null,
  usage: null,
  featureKey: AI_FEATURE_KEY,
  subscriptionKnown: false,
};

function renderQuota() {
  const planCell = document.querySelector('[data-role="quota-plan"]');
  if (planCell) {
    planCell.textContent = quota.planId ?? tr('common.value_unread');
  }

  const limitCell = document.querySelector('[data-role="quota-limit"]');
  if (limitCell) {
    limitCell.textContent =
      quota.limit === null
        ? tr('common.value_unread')
        : quota.limit === undefined
          ? tr('common.value_unlimited')
          : String(quota.limit);
  }

  const usageCell = document.querySelector('[data-role="quota-usage"]');
  if (usageCell) {
    usageCell.textContent = quota.usage === null ? tr('app.quota.usage_unread') : String(quota.usage);
  }

  const featureCell = document.querySelector('[data-role="quota-feature"]');
  if (featureCell) {
    featureCell.textContent = quota.featureKey ? String(quota.featureKey) : tr('app.quota.feature_value');
  }
}

async function loadStatus(accountId) {
  try {
    const result = await callJson('GET', '/subscription/status', undefined, accountId);
    if (result.ok && result.payload) {
      quota.subscriptionKnown = true;
      quota.planId = result.payload.subscription?.planId ?? null;
      quota.limit = result.payload.limit === undefined ? null : result.payload.limit;
      quota.featureKey = result.payload.featureKey ?? quota.featureKey;
      renderQuota();
      return result;
    }
  } catch {
    /* the server did not answer; the caller reports it per action */
  }
  return null;
}

async function loadAuthMode(accountId) {
  const statusElement = document.querySelector('[data-status="authmode"]');
  const detailElement = document.querySelector('[data-status="authmode-detail"]');
  setStatus('[data-status="authmode"]', 'plain', tr('app.authmode.reading'));

  let result;
  try {
    result = await callJson('GET', '/me', undefined, accountId);
  } catch {
    if (statusElement) statusElement.textContent = tr('app.errors.network');
    return;
  }

  const isDemo = result.ok && result.payload?.auth?.metadata?.demoAuth === true;
  const authContext = result.payload?.auth;

  if (isDemo) {
    setStatus('[data-status="authmode"]', 'warn', tr('app.authmode.demo'));
    if (detailElement) detailElement.textContent = tr('app.authmode.detail_demo');
  } else if (result.ok && authContext) {
    setStatus('[data-status="authmode"]', 'ok', tr('app.authmode.real'));
    if (detailElement) detailElement.textContent = tr('app.authmode.detail_real');
  } else {
    setStatus('[data-status="authmode"]', 'refused', tr('app.authmode.unconfigured'));
    if (detailElement) detailElement.textContent = tr('app.authmode.detail_unconfigured');
  }

  const rawElement = document.querySelector('[data-role="authmode-body"]');
  if (rawElement) {
    rawElement.textContent = JSON.stringify(
      { status: result.status, body: result.payload },
      null,
      2
    );
  }
}

function renderAiResult(result) {
  const body = result.payload ?? {};
  const isRefusal = body.code === 'QUOTA_EXCEEDED' || body.code === 'QUOTA_NOT_ENTITLED';

  setText('[data-role="ai-result-status"]', String(result.status));
  setText('[data-role="ai-result-code"]', body.code ? String(body.code) : tr('common.value_unread'));
  setText(
    '[data-role="ai-result-limit"]',
    body.limit === undefined || body.limit === null ? tr('common.value_unread') : String(body.limit)
  );
  setText(
    '[data-role="ai-result-usage"]',
    body.usage === undefined || body.usage === null ? tr('common.value_unread') : String(body.usage)
  );

  // The refusal states are never re-worded here: the server's own `error`
  // string is printed as received, next to its status code and error code.
  setText('[data-role="ai-result-error"]', body.error ? String(body.error) : tr('common.value_unread'));

  if (isRefusal) {
    setStatus(
      '[data-status="ai"]',
      'refused',
      `${result.status} ${body.code}${body.featureKey ? ` ${body.featureKey}` : ''}`
    );
  } else if (result.ok) {
    setStatus('[data-status="ai"]', 'ok', String(result.status));
  } else {
    setStatus('[data-status="ai"]', 'refused', `${result.status}${body.code ? ` ${body.code}` : ''}`);
  }

  renderServerResponse('[data-role="ai-raw"]', result);

  // The counter shown in the quota panel is the one the server returned, never
  // one this page computes.
  if (typeof body.usage === 'number') {
    quota.usage = body.usage;
  }
  if (body.limit === null || typeof body.limit === 'number') {
    quota.limit = body.limit;
  }
  if (body.featureKey) {
    quota.featureKey = String(body.featureKey);
  }
  if (!quota.planId) quota.planId = null;
  renderQuota();

  show('[data-panel="ai-result"]');
}

async function initAppPage() {
  const accountId = renderIdentity();
  renderQuota();

  if (!accountId) {
    setStatus('[data-status="ai"]', 'refused', tr('app.errors.missing_identity'));
    show('[data-panel="no-identity"]');
  } else {
    hide('[data-panel="no-identity"]');
  }

  const promptInput = document.querySelector('#prompt');
  const submit = document.querySelector('[data-action="use-ai"]');

  const sendAi = async () => {
    const current = currentAccountId();
    if (!current) {
      setStatus('[data-status="ai"]', 'refused', tr('app.errors.missing_identity'));
      show('[data-panel="no-identity"]');
      return;
    }
    const prompt = promptInput ? promptInput.value : '';
    if (submit) submit.disabled = true;
    setStatus('[data-status="ai"]', 'plain', tr('app.ai.running'));
    try {
      const result = await callJson('POST', '/ai/demo', { prompt }, current);
      renderAiResult(result);
    } catch {
      setStatus('[data-status="ai"]', 'refused', tr('app.errors.network'));
    } finally {
      if (submit) submit.disabled = false;
    }
  };

  if (submit) submit.addEventListener('click', sendAi);

  const form = document.querySelector('[data-form="ai"]');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      sendAi();
    });
  }

  const refresh = document.querySelector('[data-action="refresh-status"]');
  if (refresh) {
    refresh.addEventListener('click', async () => {
      const current = currentAccountId();
      if (!current) {
        setStatus('[data-status="ai"]', 'refused', tr('app.errors.missing_identity'));
        return;
      }
      const result = await loadStatus(current);
      if (!result) {
        setStatus('[data-status="ai"]', 'refused', tr('app.errors.network'));
      } else if (!quota.planId) {
        setStatus('[data-status="quota"]', 'warn', tr('app.quota.no_subscription'));
      } else {
        setStatus('[data-status="quota"]', 'plain', String(result.status));
      }
    });
  }

  if (accountId) {
    await loadStatus(accountId);
    if (!quota.planId) setStatus('[data-status="quota"]', 'warn', tr('app.quota.no_subscription'));
  }

  await loadAuthMode(accountId);
}

/* ------------------------------------------------------------------ bootstrap */

function init() {
  state.locale = initI18n();
  state.accountId = currentAccountId();

  const page = document.body.getAttribute('data-page');
  const initialisers = {
    index: initLandingPage,
    signup: initSignupPage,
    login: initLoginPage,
    plans: initPlansPage,
    app: initAppPage,
  };

  if (initialisers[page]) {
    initialisers[page]();
  } else {
    renderIdentity();
  }

  // Re-render the dynamic labels after a language switch that happened in this
  // page load (the switch itself navigates, so this is for the ?lang= path).
  if (isLocale(document.documentElement.getAttribute('data-locale'))) {
    applyI18n(state.locale, document);
  }

  document.documentElement.setAttribute('data-ui-ready', 'true');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { state, callJson, currentAccountId, isValidTenantId, PLAN_IDS, STORAGE_KEY };
