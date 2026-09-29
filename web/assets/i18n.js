/**
 * Bilingual (TH/EN) dictionary for the HOUSE-SWARM-7 WU-4 sample UI.
 *
 * This file is the ONLY place a visible string may live. It is used twice:
 *
 *   1. by the browser (web/assets/app.js imports `t()`, `applyI18n()`, ...), and
 *   2. by the server (server/src/lib/web-pages.ts imports `DICT` to fill the
 *      `{{key}}` placeholders of the page templates before they are sent).
 *
 * Both locales must carry exactly the same key set; that is asserted by
 * server/scripts/proofs/wu4/i18n-parity.mjs, which also asserts that no page
 * file contains visible text outside this dictionary.
 *
 * Keys are flat and dotted (`area.thing.detail`) so a key set can be compared by
 * sorting two arrays. Locale resolution order is: `?lang=` query parameter,
 * then localStorage, then the locale the server rendered, then DEFAULT_LOCALE.
 */

export const LOCALES = ['th', 'en'];
export const DEFAULT_LOCALE = 'th';
export const STORAGE_KEY = 'wu4.locale';
export const ACCOUNT_STORAGE_KEY = 'wu4.demoAccount';

/** Plan ids the sample UI knows how to label. The catalogue itself is read from
 *  the server's plan repository, not from this file. */
export const PLAN_IDS = ['free', 'pro'];

/**
 * The paid feature key this sample UI reads the quota for. It is an identifier
 * (the value of `featureKey` in the server's own responses), not a sentence, and
 * it is also the value of dictionary key `app.quota.feature_value` in both
 * locales so no screen shows it as free-standing text.
 */
export const AI_FEATURE_KEY = 'ai_requests_per_month';

export const DICT = {
  en: {
    'common.value_unread': '—',
    'common.value_unlimited': 'unlimited',

    'site.title': 'Multi-Tenant AI Starter Kit — sample UI',
    'footer.note':
      'Sample UI shipped with the Multi-Tenant AI Starter Kit reference server. No external CDN, no web font, no stock photo.',
    'footer.demo_auth_on': 'DEMO_AUTH on',
    'footer.demo_auth_off': 'DEMO_AUTH off',

    'nav.home': 'Home',
    'nav.signup': 'Sign up',
    'nav.login': 'Log in',
    'nav.plans': 'Choose a plan',
    'nav.app': 'Use the AI',

    'lang.label': 'Language',
    'lang.th': 'Thai',
    'lang.en': 'English',

    'page.index.title': 'Sample UI — Multi-Tenant AI Starter Kit',
    'page.signup.title': 'Sign up — sample UI',
    'page.login.title': 'Log in — sample UI',
    'page.plans.title': 'Choose a plan — sample UI',
    'page.app.title': 'Use the AI — sample UI',

    'demo.banner.title': 'Demonstration mode',
    'demo.banner.body':
      'This is a sample UI. Authentication mode is read live from the server and shown on the "Use the AI" screen.',

    'landing.title': 'A sample UI for the Multi-Tenant AI Starter Kit',
    'landing.intro':
      'These screens call the real HTTP endpoints of the reference server running on this machine. Nothing here is a mock-up: every plan, limit, counter and error you see is read from the running server and its database.',
    'landing.what.title': 'What these screens do',
    'landing.what.body':
      'Five static pages are served by the same Express app as the API: the landing page, sign up, log in, choose a plan, and use the AI. There is no build step and no front-end framework.',
    'landing.flow.title': 'The flow you can walk end to end',
    'landing.flow.step1':
      'Sign up or log in: enter a demo tenant id, because this sample UI has no user accounts of its own.',
    'landing.flow.step2':
      'Choose a plan: the choice is written to the subscription table in the local database.',
    'landing.flow.step3':
      'Use the AI: one request consumes one unit of the plan entitlement ai_requests_per_month.',
    'landing.flow.step4':
      'See the quota: the plan, the usage counter and the limit are shown as the server returns them.',
    'landing.demo.title': 'Demonstration identity mode (DEMO_AUTH)',
    'landing.demo.body':
      'DEMO_AUTH is off by default. While it is off, every paid endpoint sits behind the real authentication middleware and answers 503 "Auth not configured" until you point the server at your own Supabase project. When DEMO_AUTH=true, this UI can use a demo tenant id that you type, so the four screens are walkable against your local database. It is not authentication: no password, no user record, no token, and the server refuses to enable it when NODE_ENV=production.',
    'landing.start.title': 'Running it on a clean machine',
    'landing.start.body':
      'Node 20 or newer with npm. Install once in server/, then start the server. With no DATABASE_URL the server keeps its in-memory repositories; with DATABASE_URL it uses PostgreSQL and applies the migrations at boot. The exact commands are in docs/house-swarm-7/WU4-SAMPLE-UI.md.',
    'landing.honesty.title': 'What this UI is not',
    'landing.honesty.body':
      'No marketing copy, no testimonials, no invented metrics, no stock photos and no external requests of any kind. Every visible sentence comes from the locale dictionary in web/assets/i18n.js.',
    'landing.notimpl.title': 'Not implemented — do not expect these',
    'landing.notimpl.intro':
      'These capabilities are not part of this build, and this page does not pretend otherwise:',
    'landing.notimpl.otel':
      'OpenTelemetry exporter: the tracing module only records spans in process memory (MemoryTracer). There is no OTLP endpoint and no collector export.',
    'landing.notimpl.line':
      'LINE webhook verifier: the verifier returns the error code WEBHOOK_UNKNOWN_PROVIDER and states that it is not implemented.',
    'landing.notimpl.github':
      'GitHub webhook verifier: same behaviour — WEBHOOK_UNKNOWN_PROVIDER, not implemented.',
    'landing.notimpl.supabase':
      'Real Supabase authentication: the authentication path exists, but it is unverified here because this repository ships no Supabase project and no credentials.',
    'landing.notimpl.deploy':
      'Production deployment: there is no container, no reverse proxy, no TLS and no process supervisor in this repository. Run it on your own machine only.',
    'landing.notimpl.demo':
      'Demo identity is not authentication: it is a tenant id typed into a form, with no password and no session token.',

    'signup.title': 'Sign up',
    'signup.intro':
      'This sample UI has no user accounts of its own: it cannot create one, and it stores no password. Enter a demo tenant id to act as, or generate one, and the id is kept in this browser only.',
    'signup.identity.title': 'Step 1 — demo identity',
    'signup.identity.body':
      'The id you enter is sent as the x-tenant-id and x-demo-account headers. The server only accepts it when DEMO_AUTH=true.',
    'signup.tenant.label': 'Demo tenant id',
    'signup.tenant.placeholder': 'for example demo_shop_1',
    'signup.tenant.generate': 'Generate an id',
    'signup.tenant.help':
      'Letters, digits and the characters . _ - @ are accepted, up to 64 characters. Nothing is verified: this is not authentication.',
    'signup.continue': 'Continue to choose a plan',
    'signup.have_account': 'Already have an id? Log in',
    'signup.plans.title': 'Step 2 — the plans the server actually has',
    'signup.plans.note':
      'Read from the server plan table when this page was served. Choosing a plan happens on the next screen, and this page creates no account and no subscription.',

    'login.title': 'Log in',
    'login.intro':
      'Logging in here means entering the same demo tenant id again. There is no password, no email and no verification, so this screen is not authentication; it only tells the sample UI which tenant id to send.',
    'login.identity.title': 'Your demo tenant id',
    'login.tenant.label': 'Demo tenant id',
    'login.tenant.placeholder': 'the id you used before',
    'login.continue': 'Continue to the AI screen',
    'login.no_account': 'No id yet? Sign up',
    'login.notreal.body':
      'When DEMO_AUTH is off, the server ignores this id on every paid endpoint and answers 503 "Auth not configured" instead. Real log in requires your own Supabase project.',

    'plans.title': 'Choose a plan',
    'plans.intro':
      'The plan you pick is written to the subscription table of the database this server is connected to. If your account already has an active subscription the server answers 409 and nothing changes.',
    'plans.identity.title': 'Acting as',
    'plans.identity.body':
      'The subscription is created for this demo tenant id. Change it by logging in with another id.',
    'plans.table.plan': 'Plan',
    'plans.table.id': 'Plan id (database)',
    'plans.table.name': 'Name (database)',
    'plans.table.price': 'Price (database)',
    'plans.table.ai': 'ai_requests_per_month',
    'plans.table.payments': 'payments_per_month',
    'plans.table.action': 'Action',
    'plans.select': 'Choose this plan',
    'plans.per_month': 'per month',
    'plans.status.idle': 'No plan selected on this screen yet.',
    'plans.status.working': 'Sending the subscription request…',
    'plans.status.created': 'The server created the subscription. Opening the AI screen…',
    'plans.status.exists': 'This account already has an active subscription. Opening the AI screen…',
    'plans.status.error': 'The server refused the request. Its own response is printed below.',
    'plans.nodb.title': 'The plan list could not be read',
    'plans.nodb.detail':
      'The server could not read its plan repository, so no catalogue is shown. Fix the database connection and reload.',
    'plan.free.display': 'Free tier',
    'plan.pro.display': 'Pro tier',

    'app.title': 'Use the AI and read the quota',
    'app.intro':
      'One request to POST /ai/demo consumes exactly one unit of ai_requests_per_month. The counter, the plan and the limit shown below come from the server responses, not from this page.',
    'app.identity.title': 'Demo identity in use',
    'app.identity.none': 'No demo tenant id is stored in this browser.',
    'app.identity.go_login': 'Go to log in',
    'app.authmode.title': 'Authentication mode (read from the server)',
    'app.authmode.reading': 'Reading GET /me …',
    'app.authmode.demo': 'Demonstration identity — NOT real authentication',
    'app.authmode.real': 'Real authentication middleware answered GET /me',
    'app.authmode.unconfigured': 'Real authentication is not configured on this server',
    'app.authmode.detail_demo':
      'The server accepted a demo identity (auth metadata demoAuth: true): a tenant id with no password, no user record and no session token. DEMO_AUTH is on.',
    'app.authmode.detail_real':
      'GET /me returned a verified auth context from the real authentication path, so DEMO_AUTH is off and your Supabase project answered.',
    'app.authmode.detail_unconfigured':
      'GET /me answered 503 "Auth not configured": DEMO_AUTH is off and no Supabase project is configured, so the paid endpoints refuse every request. That is the current behaviour by default.',
    'app.quota.title': 'Quota for ai_requests_per_month',
    'app.quota.plan': 'Plan (subscription.planId)',
    'app.quota.limit': 'Limit (server limit)',
    'app.quota.usage': 'Usage counter (server usage)',
    'app.quota.feature': 'Feature key',
    'app.quota.feature_value': 'ai_requests_per_month',
    'app.quota.usage_unread':
      'not read yet — the counter is returned by POST /ai/demo, so press Use the AI',
    'app.quota.no_subscription':
      'The server reports no subscription for this id, so there is no entitlement and no limit to show.',
    'app.quota.refresh': 'Re-read GET /subscription/status',
    'app.ai.title': 'Ask the AI',
    'app.ai.prompt.label': 'Prompt',
    'app.ai.prompt.placeholder': 'Type anything; the server sends it to the configured provider',
    'app.ai.submit': 'Use the AI (consumes 1 unit)',
    'app.ai.running': 'Sending POST /ai/demo …',
    'app.ai.result_title': 'What the server returned',
    'app.ai.raw': 'Raw response body',
    'app.response.title': 'Server response, printed as received',
    'app.response.hint':
      'These values are the server\'s own response fields, shown verbatim. When the quota gate refuses, the server sends 402 QUOTA_NOT_ENTITLED or 429 QUOTA_EXCEEDED and this page shows its code, its limit and its usage unchanged.',
    'app.response.status': 'HTTP status',
    'app.response.code': 'code',
    'app.response.limit': 'limit',
    'app.response.usage': 'usage',
    'app.response.server_message': 'error (server wording)',
    'app.errors.missing_identity':
      'No demo tenant id is stored in this browser, so no request was sent. Log in first.',
    'app.errors.network': 'The request could not reach the server.',
  },

  th: {
    'common.value_unread': '—',
    'common.value_unlimited': 'ไม่จำกัด',

    'site.title': 'Multi-Tenant AI Starter Kit — หน้าตัวอย่าง',
    'footer.note':
      'หน้าตัวอย่างที่แถมมากับ reference server ของ Multi-Tenant AI Starter Kit · ไม่โหลดฟอนต์หรือรูปจากภายนอก ไม่มี CDN ไม่มีรูปสต็อก',
    'footer.demo_auth_on': 'DEMO_AUTH เปิดอยู่',
    'footer.demo_auth_off': 'DEMO_AUTH ปิดอยู่',

    'nav.home': 'หน้าแรก',
    'nav.signup': 'สมัคร',
    'nav.login': 'เข้าสู่ระบบ',
    'nav.plans': 'เลือกแพ็กเกจ',
    'nav.app': 'ใช้ AI',

    'lang.label': 'ภาษา',
    'lang.th': 'ไทย',
    'lang.en': 'อังกฤษ',

    'page.index.title': 'หน้าตัวอย่าง — Multi-Tenant AI Starter Kit',
    'page.signup.title': 'สมัคร — หน้าตัวอย่าง',
    'page.login.title': 'เข้าสู่ระบบ — หน้าตัวอย่าง',
    'page.plans.title': 'เลือกแพ็กเกจ — หน้าตัวอย่าง',
    'page.app.title': 'ใช้ AI — หน้าตัวอย่าง',

    'demo.banner.title': 'โหมดสาธิต',
    'demo.banner.body':
      'นี่คือหน้าตัวอย่าง · โหมดการยืนยันตัวตนจะอ่านจากเซิร์ฟเวอร์จริง และแสดงในหน้า "ใช้ AI"',

    'landing.title': 'หน้าตัวอย่างของ Multi-Tenant AI Starter Kit',
    'landing.intro':
      'หน้าพวกนี้เรียก HTTP endpoint จริงของ reference server ที่รันอยู่บนเครื่องนี้ ไม่มีอะไรเป็นภาพmock: แพ็กเกจ เพดาน ตัวนับ และข้อผิดพลาดที่เห็น ล้วนอ่านมาจากเซิร์ฟเวอร์ที่กำลังรันและฐานข้อมูลของมัน',
    'landing.what.title': 'หน้าพวกนี้ทำอะไร',
    'landing.what.body':
      'มี 5 หน้า static ที่เสิร์ฟโดย express app ตัวเดียวกับ API: หน้าแรก สมัคร เข้าสู่ระบบ เลือกแพ็กเกจ และใช้ AI ไม่มีขั้นตอน build และไม่มีเฟรมเวิร์กฝั่งหน้าเว็บ',
    'landing.flow.title': 'เส้นทางที่เดินได้ครบ',
    'landing.flow.step1':
      'สมัครหรือเข้าสู่ระบบ: ใส่ demo tenant id เพราะหน้าตัวอย่างนี้ไม่มีบัญชีผู้ใช้ของตัวเอง',
    'landing.flow.step2':
      'เลือกแพ็กเกจ: ตัวเลือกจะถูกเขียนลงตาราง subscription ในฐานข้อมูล local',
    'landing.flow.step3':
      'ใช้ AI: หนึ่งคำขอใช้โควตา ai_requests_per_month หนึ่งหน่วย',
    'landing.flow.step4':
      'ดูโควตา: แพ็กเกจ ตัวนับการใช้ และเพดาน จะแสดงตามที่เซิร์ฟเวอร์ตอบกลับมา',
    'landing.demo.title': 'โหมดตัวตนสาธิต (DEMO_AUTH)',
    'landing.demo.body':
      'DEMO_AUTH ปิดเป็นค่าเริ่มต้น ระหว่างที่ปิด ทุก endpoint ที่มีค่าใช้จ่ายอยู่หลัง auth middleware ตัวจริง และจะตอบ 503 "Auth not configured" จนกว่าจะชี้เซิร์ฟเวอร์ไปที่โปรเจกต์ Supabase ของคุณเอง เมื่อ DEMO_AUTH=true หน้าตัวอย่างนี้ใช้ demo tenant id ที่พิมพ์เองได้ เพื่อให้เดินครบทั้งสี่หน้าจอกับฐานข้อมูล local ได้ · นี่ไม่ใช่การยืนยันตัวตน: ไม่มีรหัสผ่าน ไม่มีบัญชีผู้ใช้ ไม่มีโทเคน และเซิร์ฟเวอร์จะปฏิเสธที่จะเปิดโหมดนี้เมื่อ NODE_ENV=production',
    'landing.start.title': 'รันบนเครื่องสะอาด',
    'landing.start.body':
      'ต้องมี Node 20 ขึ้นไปพร้อม npm ติดตั้งครั้งเดียวในโฟลเดอร์ server/ แล้วสตาร์ทเซิร์ฟเวอร์ ถ้าไม่ตั้ง DATABASE_URL เซิร์ฟเวอร์จะใช้ repository ในหน่วยความจำ ถ้าตั้ง DATABASE_URL จะใช้ PostgreSQL และรัน migration ให้ตอนบูต คำสั่งทั้งหมดอยู่ใน docs/house-swarm-7/WU4-SAMPLE-UI.md',
    'landing.honesty.title': 'หน้าตัวอย่างนี้ไม่ใช่อะไร',
    'landing.honesty.body':
      'ไม่มีข้อความโฆษณา ไม่มีคำรับรองจากลูกค้า ไม่มีตัวเลขที่กุขึ้น ไม่มีรูปสต็อก และไม่มีการเรียกออกไปภายนอกเลย ทุกประโยคที่เห็นมาจาก dictionary ภาษาใน web/assets/i18n.js',
    'landing.notimpl.title': 'ยังไม่ได้ทำ — อย่าคาดหวังสิ่งเหล่านี้',
    'landing.notimpl.intro':
      'ความสามารถต่อไปนี้ยังไม่มีในบิลด์นี้ และหน้านี้ก็ไม่แกล้งทำเป็นว่ามี:',
    'landing.notimpl.otel':
      'OpenTelemetry exporter: โมดูล tracing เก็บ span ไว้ในหน่วยความจำของ process เท่านั้น (MemoryTracer) ไม่มี OTLP endpoint และไม่มีการส่งออกไป collector',
    'landing.notimpl.line':
      'LINE webhook verifier: ตัวตรวจสอบคืนรหัสข้อผิดพลาด WEBHOOK_UNKNOWN_PROVIDER และระบุตรง ๆ ว่ายังไม่ได้ทำ',
    'landing.notimpl.github':
      'GitHub webhook verifier: พฤติกรรมเดียวกัน — WEBHOOK_UNKNOWN_PROVIDER ยังไม่ได้ทำ',
    'landing.notimpl.supabase':
      'การยืนยันตัวตน Supabase จริง: เส้นทาง auth มีอยู่ แต่ยังพิสูจน์ที่นี่ไม่ได้ เพราะที่เก็บโค้ดนี้ไม่มีโปรเจกต์ Supabase และไม่มี credential',
    'landing.notimpl.deploy':
      'การ deploy ขึ้น production: ไม่มี container ไม่มี reverse proxy ไม่มี TLS และไม่มี process supervisor ในที่เก็บโค้ดนี้ ใช้รันบนเครื่องตัวเองเท่านั้น',
    'landing.notimpl.demo':
      'ตัวตนสาธิตไม่ใช่การยืนยันตัวตน: มันคือ tenant id ที่พิมพ์ในฟอร์ม ไม่มีรหัสผ่านและไม่มี session token',

    'signup.title': 'สมัคร',
    'signup.intro':
      'หน้าตัวอย่างนี้ไม่มีบัญชีผู้ใช้ของตัวเอง: สร้างบัญชีไม่ได้ และไม่เก็บรหัสผ่าน ใส่ demo tenant id ที่จะใช้ หรือกดสร้างให้ ตัว id จะถูกเก็บไว้ในเบราว์เซอร์นี้เท่านั้น',
    'signup.identity.title': 'ขั้นที่ 1 — ตัวตนสาธิต',
    'signup.identity.body':
      'id ที่ใส่จะถูกส่งไปเป็น header x-tenant-id และ x-demo-account เซิร์ฟเวอร์จะยอมรับก็ต่อเมื่อ DEMO_AUTH=true',
    'signup.tenant.label': 'demo tenant id',
    'signup.tenant.placeholder': 'ตัวอย่างเช่น demo_shop_1',
    'signup.tenant.generate': 'สร้าง id ให้',
    'signup.tenant.help':
      'ใช้ตัวอักษร ตัวเลข และเครื่องหมาย . _ - @ ได้ ไม่เกิน 64 ตัวอักษร ไม่มีการตรวจสอบใด ๆ นี่ไม่ใช่การยืนยันตัวตน',
    'signup.continue': 'ไปเลือกแพ็กเกจต่อ',
    'signup.have_account': 'มี id อยู่แล้ว? เข้าสู่ระบบ',
    'signup.plans.title': 'ขั้นที่ 2 — แพ็กเกจที่เซิร์ฟเวอร์มีจริง',
    'signup.plans.note':
      'อ่านจากตาราง plan ของเซิร์ฟเวอร์ตอนที่เสิร์ฟหน้านี้ การเลือกแพ็กเกจเกิดในหน้าถัดไป หน้านี้ไม่สร้างบัญชีและไม่สร้าง subscription',

    'login.title': 'เข้าสู่ระบบ',
    'login.intro':
      'การเข้าสู่ระบบที่นี่คือการใส่ demo tenant id เดิมอีกครั้ง ไม่มีรหัสผ่าน ไม่มีอีเมล และไม่มีการตรวจสอบ ดังนั้นหน้านี้ไม่ใช่การยืนยันตัวตน มันแค่บอกหน้าตัวอย่างว่าจะส่ง tenant id ตัวไหน',
    'login.identity.title': 'demo tenant id ของคุณ',
    'login.tenant.label': 'demo tenant id',
    'login.tenant.placeholder': 'id ที่เคยใช้',
    'login.continue': 'ไปหน้าใช้ AI ต่อ',
    'login.no_account': 'ยังไม่มี id? สมัคร',
    'login.notreal.body':
      'เมื่อ DEMO_AUTH ปิด เซิร์ฟเวอร์จะไม่สนใจ id นี้ในทุก endpoint ที่มีค่าใช้จ่าย และจะตอบ 503 "Auth not configured" แทน การเข้าสู่ระบบจริงต้องใช้โปรเจกต์ Supabase ของคุณเอง',

    'plans.title': 'เลือกแพ็กเกจ',
    'plans.intro':
      'แพ็กเกจที่เลือกจะถูกเขียนลงตาราง subscription ของฐานข้อมูลที่เซิร์ฟเวอร์นี้เชื่อมอยู่ ถ้าบัญชีมี subscription ที่ยังใช้งานอยู่แล้ว เซิร์ฟเวอร์จะตอบ 409 และไม่มีอะไรเปลี่ยน',
    'plans.identity.title': 'กำลังกระทำในนาม',
    'plans.identity.body':
      'subscription จะถูกสร้างให้ demo tenant id นี้ ต้องการเปลี่ยนให้เข้าสู่ระบบด้วย id อื่น',
    'plans.table.plan': 'แพ็กเกจ',
    'plans.table.id': 'plan id (ฐานข้อมูล)',
    'plans.table.name': 'ชื่อ (ฐานข้อมูล)',
    'plans.table.price': 'ราคา (ฐานข้อมูล)',
    'plans.table.ai': 'ai_requests_per_month',
    'plans.table.payments': 'payments_per_month',
    'plans.table.action': 'การกระทำ',
    'plans.select': 'เลือกแพ็กเกจนี้',
    'plans.per_month': 'ต่อเดือน',
    'plans.status.idle': 'หน้านี้ยังไม่ได้เลือกแพ็กเกจ',
    'plans.status.working': 'กำลังส่งคำขอ subscription…',
    'plans.status.created': 'เซิร์ฟเวอร์สร้าง subscription แล้ว กำลังเปิดหน้าใช้ AI…',
    'plans.status.exists': 'บัญชีนี้มี subscription ที่ใช้งานอยู่แล้ว กำลังเปิดหน้าใช้ AI…',
    'plans.status.error': 'เซิร์ฟเวอร์ปฏิเสธคำขอ คำตอบจริงของเซิร์ฟเวอร์แสดงอยู่ด้านล่าง',
    'plans.nodb.title': 'อ่านรายการแพ็กเกจไม่ได้',
    'plans.nodb.detail':
      'เซิร์ฟเวอร์อ่าน plan repository ไม่ได้ จึงไม่แสดงรายการ แก้การเชื่อมต่อฐานข้อมูลแล้วโหลดใหม่',
    'plan.free.display': 'แพ็กเกจฟรี',
    'plan.pro.display': 'แพ็กเกจ Pro',

    'app.title': 'ใช้ AI และดูโควตา',
    'app.intro':
      'หนึ่งคำขอไปที่ POST /ai/demo ใช้โควตา ai_requests_per_month หนึ่งหน่วยพอดี ตัวนับ แพ็กเกจ และเพดานที่แสดงด้านล่างมาจากคำตอบของเซิร์ฟเวอร์ ไม่ใช่จากการกุในหน้านี้',
    'app.identity.title': 'ตัวตนสาธิตที่กำลังใช้',
    'app.identity.none': 'เบราว์เซอร์นี้ยังไม่ได้เก็บ demo tenant id',
    'app.identity.go_login': 'ไปหน้าเข้าสู่ระบบ',
    'app.authmode.title': 'โหมดการยืนยันตัวตน (อ่านจากเซิร์ฟเวอร์)',
    'app.authmode.reading': 'กำลังอ่าน GET /me …',
    'app.authmode.demo': 'ตัวตนสาธิต — ไม่ใช่การยืนยันตัวตนจริง',
    'app.authmode.real': 'auth middleware ตัวจริงตอบ GET /me',
    'app.authmode.unconfigured': 'เซิร์ฟเวอร์นี้ยังไม่ได้ตั้งค่าการยืนยันตัวตนจริง',
    'app.authmode.detail_demo':
      'เซิร์ฟเวอร์ยอมรับตัวตนสาธิต (metadata ของ auth มี demoAuth: true): เป็น tenant id ที่ไม่มีรหัสผ่าน ไม่มีบัญชีผู้ใช้ และไม่มี session token แปลว่า DEMO_AUTH เปิดอยู่',
    'app.authmode.detail_real':
      'GET /me ตอบกลับ auth context ที่ผ่านการตรวจสอบจากเส้นทาง auth จริง แปลว่า DEMO_AUTH ปิดอยู่ และโปรเจกต์ Supabase ของคุณตอบรับ',
    'app.authmode.detail_unconfigured':
      'GET /me ตอบ 503 "Auth not configured": DEMO_AUTH ปิดอยู่ และยังไม่ได้ตั้งค่าโปรเจกต์ Supabase ดังนั้นทุก endpoint ที่มีค่าใช้จ่ายจะปฏิเสธทุกคำขอ นี่คือพฤติกรรมเริ่มต้นในปัจจุบัน',
    'app.quota.title': 'โควตาของ ai_requests_per_month',
    'app.quota.plan': 'แพ็กเกจ (subscription.planId)',
    'app.quota.limit': 'เพดาน (limit จากเซิร์ฟเวอร์)',
    'app.quota.usage': 'ตัวนับการใช้ (usage จากเซิร์ฟเวอร์)',
    'app.quota.feature': 'feature key',
    'app.quota.feature_value': 'ai_requests_per_month',
    'app.quota.usage_unread':
      'ยังไม่ได้อ่าน — ตัวนับจะมากับคำตอบของ POST /ai/demo จึงต้องกดปุ่ม ใช้ AI',
    'app.quota.no_subscription':
      'เซิร์ฟเวอร์แจ้งว่า id นี้ไม่มี subscription จึงไม่มีสิทธิ์และไม่มีเพดานให้แสดง',
    'app.quota.refresh': 'อ่าน GET /subscription/status ใหม่',
    'app.ai.title': 'ถาม AI',
    'app.ai.prompt.label': 'คำสั่ง (prompt)',
    'app.ai.prompt.placeholder': 'พิมพ์อะไรก็ได้ เซิร์ฟเวอร์จะส่งไปยังผู้ให้บริการที่ตั้งไว้',
    'app.ai.submit': 'ใช้ AI (ใช้โควตา 1 หน่วย)',
    'app.ai.running': 'กำลังส่ง POST /ai/demo …',
    'app.ai.result_title': 'สิ่งที่เซิร์ฟเวอร์ตอบกลับ',
    'app.ai.raw': 'เนื้อคำตอบดิบ (raw body)',
    'app.response.title': 'คำตอบของเซิร์ฟเวอร์ ตามที่ได้รับจริง',
    'app.response.hint':
      'ค่าพวกนี้เป็นฟิลด์จากคำตอบจริงของเซิร์ฟเวอร์ แสดงแบบไม่แก้คำ เมื่อโควตาถูกปฏิเสธ เซิร์ฟเวอร์จะส่ง 402 QUOTA_NOT_ENTITLED หรือ 429 QUOTA_EXCEEDED และหน้านี้จะแสดง code, limit และ usage ตามเดิมทุกตัวอักษร',
    'app.response.status': 'สถานะ HTTP',
    'app.response.code': 'code',
    'app.response.limit': 'limit',
    'app.response.usage': 'usage',
    'app.response.server_message': 'error (ข้อความของเซิร์ฟเวอร์)',
    'app.errors.missing_identity':
      'เบราว์เซอร์นี้ไม่ได้เก็บ demo tenant id จึงไม่ได้ส่งคำขอใด ๆ เข้าสู่ระบบก่อน',
    'app.errors.network': 'ส่งคำขอไปถึงเซิร์ฟเวอร์ไม่ได้',
  },
};

/** True when `value` is one of the supported locale codes. */
export function isLocale(value) {
  return typeof value === 'string' && LOCALES.includes(value);
}

/** Reads the persisted locale; safe in a browser without localStorage. */
export function readStoredLocale() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  } catch {
    return null;
  }
}

/**
 * Locale resolution: `?lang=` query parameter wins, then the persisted value,
 * then the locale the server rendered (`fallback`), then DEFAULT_LOCALE.
 */
export function resolveLocale(options = {}) {
  const search = options.search ?? (typeof location !== 'undefined' ? location.search : '');
  const stored = options.stored === undefined ? readStoredLocale() : options.stored;
  const fallback = options.fallback ?? DEFAULT_LOCALE;

  let fromQuery = null;
  try {
    fromQuery = new URLSearchParams(search).get('lang');
  } catch {
    fromQuery = null;
  }

  if (isLocale(fromQuery)) return fromQuery;
  if (isLocale(stored)) return stored;
  if (isLocale(fallback)) return fallback;
  return DEFAULT_LOCALE;
}

/** Looks a key up for a locale, falling back to the other locale (never to a literal). */
export function lookup(key, locale) {
  const table = DICT[isLocale(locale) ? locale : DEFAULT_LOCALE];
  if (table && Object.prototype.hasOwnProperty.call(table, key)) return table[key];
  const fallbackTable = DICT.en;
  if (fallbackTable && Object.prototype.hasOwnProperty.call(fallbackTable, key)) {
    return fallbackTable[key];
  }
  return null;
}

/** The translated string for `key`, or a visible marker when the key is unknown. */
export function t(key, locale) {
  const value = lookup(key, locale);
  return value === null ? `[${key}]` : value;
}

/** Replaces `{name}` placeholders in a dictionary string with values. */
export function formatTemplate(template, params = {}) {
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  );
}

/** `t()` + `formatTemplate()` in one call. */
export function tFormat(key, locale, params) {
  return formatTemplate(t(key, locale), params);
}

/**
 * Fills every element that carries a data-i18n* attribute from the dictionary.
 * Text is always written with textContent: dictionary values are never markup.
 */
export function applyI18n(locale, root) {
  const scope = root ?? (typeof document !== 'undefined' ? document : null);
  if (!scope) return;

  const attributeMap = {
    i18n: null,
    'i18n-placeholder': 'placeholder',
    'i18n-title': 'title',
    'i18n-aria-label': 'aria-label',
    'i18n-value': 'value',
  };

  for (const name of Object.keys(attributeMap)) {
    const selector = `[data-${name}]`;
    for (const element of scope.querySelectorAll(selector)) {
      const key = element.getAttribute(`data-${name}`);
      if (!key) continue;
      const value = t(key, locale);
      const target = attributeMap[name];
      if (target === null) {
        element.textContent = value;
      } else {
        element.setAttribute(target, value);
      }
    }
  }

  if (scope.documentElement) {
    scope.documentElement.setAttribute('lang', locale);
    scope.documentElement.setAttribute('data-locale', locale);
  }
}

/**
 * Resolves the locale for this page load, persists it, applies it, and wires the
 * language switch (which also writes the choice to localStorage so it survives
 * the next page).
 */
export function initI18n() {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;

  const serverLocale = document.documentElement.getAttribute('data-locale');
  const hasQueryLocale = isLocale(new URLSearchParams(location.search).get('lang'));
  const locale = resolveLocale({ fallback: serverLocale });

  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* storage unavailable: the ?lang= parameter still works */
  }

  if (hasQueryLocale || locale !== serverLocale) {
    applyI18n(locale, document);
  }

  // Keep the switch on the current page while the choice itself comes from the
  // dictionary; other query parameters (for example ?tenant=) are preserved.
  for (const link of document.querySelectorAll('[data-locale-option]')) {
    const target = link.getAttribute('data-locale-option');
    if (!isLocale(target)) continue;
    const next = new URL(location.href);
    next.searchParams.set('lang', target);
    link.setAttribute('href', `${next.pathname}${next.search}${next.hash}`);
    link.setAttribute('aria-current', target === locale ? 'true' : 'false');
    link.addEventListener('click', () => {
      try {
        localStorage.setItem(STORAGE_KEY, target);
      } catch {
        /* ignore */
      }
    });
  }

  return locale;
}
