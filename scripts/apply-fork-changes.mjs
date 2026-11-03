/**
 * Fork-only browser changes that must be re-applied after `npm run build`
 * (scripts/sync-client-pricing.mjs regenerates the shared PRICING and BALANCE
 * sections of lib/client.js from lib/pricing.js and lib/balance.js).
 *
 * The changes here are outside those shared sections:
 *   - a Russian dictionary (ru) for the peakIndicator namespace;
 *   - per-locale dictionary registration (zh, en, ru) that tolerates a
 *     third-party locale pack already owning one of them;
 *   - countdown units from the active locale (unit.hour / unit.minute) instead
 *     of hardcoded Chinese; zh and en dictionaries carry those keys;
 *   - a Russian translation of this package's own Plugins-page one-liner,
 *     applied through locale.resolveText only while `ru` is active.
 *
 * Language behavior after this patch:
 *   - zh: every string is the upstream Chinese text (nothing changes);
 *   - ru: Russian copy, including the countdown units and the package one-liner;
 *   - en and any other locale: their own dictionary when one exists, otherwise
 *     the English fallback (the locale service walks the fallback chain to en).
 *
 * USD balance formatting is not touched here: it lives in lib/balance.js and
 * reaches the browser through the build script.
 *
 * Usage: node scripts/apply-fork-changes.mjs
 */
import { readFileSync, writeFileSync } from "node:fs"

const FILE = new URL("../lib/client.js", import.meta.url)
let source = readFileSync(FILE, "utf8").replace(/\r\n/g, "\n")
const applied = []
const skipped = []

function replace(name, from, to) {
  if (source.includes(to) && !source.includes(from)) {
    skipped.push(name)
    return
  }
  const count = source.split(from).length - 1
  if (count !== 1) throw new Error(`${name}: expected exactly one anchor, found ${count}`)
  source = source.replace(from, to)
  applied.push(name)
}

/** Like replace, but detects an already-patched state by a stable signature. */
function replaceOnce(name, from, to, signature) {
  if (source.includes(signature)) {
    skipped.push(name)
    return
  }
  const count = source.split(from).length - 1
  if (count !== 1) throw new Error(`${name}: expected exactly one anchor, found ${count}`)
  source = source.replace(from, to)
  applied.push(name)
}

function insertAfter(name, anchor, addition, signature) {
  if (source.includes(signature)) {
    skipped.push(name)
    return
  }
  const count = source.split(anchor).length - 1
  if (count !== 1) throw new Error(`${name}: expected exactly one anchor, found ${count}`)
  source = source.replace(anchor, anchor + addition)
  applied.push(name)
}

function insertBefore(name, anchor, addition, signature) {
  if (source.includes(signature)) {
    skipped.push(name)
    return
  }
  const count = source.split(anchor).length - 1
  if (count !== 1) throw new Error(`${name}: expected exactly one anchor, found ${count}`)
  source = source.replace(anchor, addition + anchor)
  applied.push(name)
}

// --- dictionaries ----------------------------------------------------------
insertAfter(
  "zh countdown units",
  '"tip.unavailable": "当前模型暂不可用"',
  ', "unit.hour": "小时", "unit.minute": "分钟"',
  '"unit.hour": "小时"',
)
insertAfter(
  "en countdown units",
  '"tip.unavailable": "Current model unavailable"',
  ', "unit.hour": "h", "unit.minute": "min"',
  '"unit.hour": "h"',
)
insertAfter(
  "russian dictionary",
  `"balance.offline": "DSH account balance service is unavailable"
    });`,
  `

    // Fork: Russian copy for the same namespace. It is registered for the
    // \`ru\` locale only, so Chinese stays byte-for-byte upstream copy and any
    // other language keeps its own dictionary or the English fallback.
    var ru = {
      "badge.peak": "⚡ Пик",
      "badge.offpeak": "🌙 Вне пика",
      "badge.other": "🌿 Другая модель",
      "badge.next": " · переключение через {countdown}",
      "badge.cost": " · {symbol}{amount}",

      "turn.cost": "Ход {symbol}{amount}",
      "turn.tip": "Оценка стоимости токенов за этот ход",

      "tip.price": "Ввод {symbol}{input} · вывод {symbol}{output} · кэш {symbol}{cacheHitInput} / 1 млн токенов",
      "tip.scope": "Только известные токены; без поиска и загрузки страниц",
      "tip.unknown": "Тариф модели недоступен",
      "tip.loading": "Загрузка модели",
      "tip.unavailable": "Текущая модель недоступна",
      "unit.hour": "ч",
      "unit.minute": "мин",

      "balance.amount": "Баланс {amount}",
      "balance.tip": "Аккаунт DSH · Пополнение {recharge} · Бонус {bonus}. Нажмите, чтобы обновить",
      "balance.loading": "Загрузка баланса аккаунта…",
      "balance.signed-out": "Баланс: нет входа",
      "balance.failed": "Баланс: ошибка",
      "balance.unavailable": "Баланс: недоступен",
      "balance.no-cny": "Баланс: кошелёк не найден",
      "balance.retry": "Баланс аккаунта DSH; нажмите для повтора",
      "balance.login": "Войдите в аккаунт DeepSeek в настройках DSH",
      "balance.wait": "Чтение баланса аккаунта DSH",
      "balance.offline": "Сервис баланса DSH недоступен"
    };`,
  "var ru = {",
)

// --- exports used by the test suite ---------------------------------------
insertAfter("ru export", "      en: () => en,\n", "      ru: () => ru,\n", "      ru: () => ru,")
insertAfter(
  "formatCountdown export",
  "      formatPrice: () => formatPrice,\n",
  "      formatCountdown: () => formatCountdown,\n",
  "      formatCountdown: () => formatCountdown,",
)

// --- localized countdown call site ----------------------------------------
// formatCountdown itself lives in lib/pricing.js (a shared module) and is
// localized there; the build script injects it into the bundle. Only the call
// site below is client-only.
replace(
  "countdown call site",
  "formatCountdown(nextTransitionInMinutes(now))",
  "formatCountdown(nextTransitionInMinutes(now), t)",
)

// --- registration and package text -----------------------------------------
replaceOnce(
  "locale-aware dictionary registration",
  `      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "peak-indicator: dictionaries");`,
  `      // Fork: register each locale on its own. A third-party locale pack that
      // already registered one of these dictionaries must not fail the whole
      // plugin; an unknown locale keeps walking its chain to the en fallback.
      ctx.effect(() => {
        const disposers = [];
        const register = (locale, dict) => {
          try {
            disposers.push(ctx.locale.register(NS, locale, dict));
          } catch (error) {
            if (!(error instanceof Error) || error.message.indexOf("already has") === -1) throw error;
          }
        };
        register("zh", zh);
        register("en", en);
        register("ru", ru);
        return () => { for (const dispose of disposers.reverse()) dispose(); };
      }, "peak-indicator: dictionaries");
      ctx.effect(() => installPluginText(ctx.locale), "peak-indicator: plugin text");`,
  'register("ru", ru);',
)

// Cross-realm safe duplicate check: an error thrown across VM/iframe realms is
// not `instanceof` this realm's Error, so only the message and shape matter.
replace(
  "cross-realm duplicate tolerance",
  `            if (!(error instanceof Error) || error.message.indexOf("already has") === -1) throw error;`,
  `            if (!error || typeof error.message !== "string" || error.message.indexOf("already has") === -1) throw error;`,
)

insertBefore(
  "package one-liner translation",
  `    var inject = ["slots", "locale", "modelDirectories"];`,
  `    // Fork: this package's own Plugins-page one-liner, translated for Russian
    // only. resolveText is the single point every LocalizedText passes through.
    const PLUGIN_TEXT = {
      "DeepSeek 峰谷时段、人民币 Token 费用估算与账户余额 for DSH Web / Desktop":
        "Пиковые и непиковые часы DeepSeek, оценка расходов в юанях и баланс аккаунта для DSH Web / Desktop"
    };

    function installPluginText(locale) {
      const prototype = Object.getPrototypeOf(locale);
      const original = prototype.resolveText;
      if (typeof original !== "function") return () => {};
      if (Object.prototype.hasOwnProperty.call(prototype, "__dshPeakIndicatorRuMeta")) {
        return prototype.__dshPeakIndicatorRuMeta;
      }
      const patched = function (text) {
        const resolved = original.call(this, text);
        if (this.getSnapshot().active !== "ru") return resolved;
        return Object.prototype.hasOwnProperty.call(PLUGIN_TEXT, resolved) ? PLUGIN_TEXT[resolved] : resolved;
      };
      const restore = () => {
        if (prototype.resolveText === patched) {
          prototype.resolveText = original;
          delete prototype.__dshPeakIndicatorRuMeta;
        }
      };
      prototype.resolveText = patched;
      prototype.__dshPeakIndicatorRuMeta = restore;
      return restore;
    }

`,
  "function installPluginText(locale) {",
)

// --- automatic cost currency: wallet currency store -----------------------
insertAfter(
  "wallet currency store",
  `    // END SHARED BALANCE`,
  `

    // Fork: the balance store publishes the auto-picked wallet currency so the
    // header badge and the per-turn chip choose the same peakCost projection.
    function createWalletCurrencyStore(balance) {
      let currency;
      const listeners = new Set();
      const read = () => {
        const snapshot = balance.getSnapshot();
        return snapshot && snapshot.status === "ready" ? snapshot.currency : undefined;
      };
      const publish = () => {
        const next = read();
        if (next === currency) return;
        currency = next;
        for (const listener of listeners) listener();
      };
      const unsubscribe = balance.subscribe(publish);
      publish();
      return {
        getSnapshot: () => currency,
        subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
        dispose: () => { unsubscribe(); listeners.clear(); }
      };
    }

    // Used when a component renders without the wallet store (tests, old host).
    const EMPTY_CURRENCY_STORE = { getSnapshot: () => undefined, subscribe: () => () => {} };`,
  "function createWalletCurrencyStore(balance)",
)

replace(
  "badge takes the wallet currency store",
  `    function PeakBadge({ t, directory, load, useProjection, balance }) {`,
  `    function PeakBadge({ t, directory, load, useProjection, balance, currency: walletCurrencyStore }) {`,
)

replace(
  "badge projection follows the wallet currency",
  `      const projection = useProjection("peakCost");
      // Selection is durable session data.`,
  `      const primaryProjection = useProjection("peakCost");
      const alternateProjection = useProjection("peakCostAlt");
      const walletCurrency = walletCurrencyStore && typeof walletCurrencyStore.subscribe === "function"
        ? walletCurrencyStore : EMPTY_CURRENCY_STORE;
      // Fork: follow the wallet currency picked from the funded balance; the
      // configured projection stays the fallback until the balance is known.
      const wallet = import_react.default.useSyncExternalStore(walletCurrency.subscribe, walletCurrency.getSnapshot, walletCurrency.getSnapshot);
      const projection = wallet && alternateProjection?.currency === wallet && primaryProjection?.currency !== wallet
        ? alternateProjection : primaryProjection;
      // Selection is durable session data.`,
)

replace(
  "turn chip takes the wallet currency store",
  `    function TurnCost({ messageId, useProjection, t }) {`,
  `    function TurnCost({ messageId, useProjection, t, currency: walletCurrencyStore }) {`,
)

replace(
  "turn chip projection follows the wallet currency",
  `      const projection = useProjection("peakCost");
      if (typeof projection !== "object" || projection === null) return null;`,
  `      const primaryProjection = useProjection("peakCost");
      const alternateProjection = useProjection("peakCostAlt");
      const walletCurrency = walletCurrencyStore && typeof walletCurrencyStore.subscribe === "function"
        ? walletCurrencyStore : EMPTY_CURRENCY_STORE;
      const wallet = import_react.default.useSyncExternalStore(walletCurrency.subscribe, walletCurrency.getSnapshot, walletCurrency.getSnapshot);
      const projection = wallet && alternateProjection?.currency === wallet && primaryProjection?.currency !== wallet
        ? alternateProjection : primaryProjection;
      if (typeof projection !== "object" || projection === null) return null;`,
)

replaceOnce(
  "apply creates the wallet currency store",
  `      const balance = createBalanceStore();
      ctx.effect(() => () => balance.dispose(), "peak-indicator: balance store");`,
  `      const balance = createBalanceStore();
      ctx.effect(() => () => balance.dispose(), "peak-indicator: balance store");
      const walletCurrencyStore = createWalletCurrencyStore(balance);
      ctx.effect(() => () => walletCurrencyStore.dispose(), "peak-indicator: wallet currency");`,
  "const walletCurrencyStore = createWalletCurrencyStore(balance);",
)

replace(
  "badge slot passes the wallet currency store",
  `            return {
              balance,
              directory: directory.store,
              load: () => directory.load().catch(() => {})
            };
          } catch {
            return { directory: null, balance };
          }`,
  `            return {
              balance,
              currency: walletCurrencyStore,
              directory: directory.store,
              load: () => directory.load().catch(() => {})
            };
          } catch {
            return { directory: null, balance, currency: walletCurrencyStore };
          }`,
)

replace(
  "turn chip slot passes the wallet currency store",
  `      ctx.slots.inject("conversation.chat.assistant-actions", () => ctx.slots.register({
        name: "conversation.chat.assistant-actions",
        id: "peak-indicator",
        order: 100,
        locale: NS
      }, TurnCost));`,
  `      ctx.slots.inject("conversation.chat.assistant-actions", () => ctx.slots.register({
        name: "conversation.chat.assistant-actions",
        id: "peak-indicator",
        order: 100,
        locale: NS,
        inject: () => ({ currency: walletCurrencyStore })
      }, TurnCost));`,
)

try {
  new Function(source)
} catch (error) {
  console.error("resulting bundle has a syntax error:", error.message)
  process.exit(1)
}

writeFileSync(FILE, source, "utf8")
console.log("applied:", applied.length ? applied.join(", ") : "none")
console.log("already applied:", skipped.length ? skipped.join(", ") : "none")
