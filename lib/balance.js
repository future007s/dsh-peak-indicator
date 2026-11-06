// Account balance uses DSH's authenticated Host RPC; credentials never enter the browser.
function decimalParts(text) {
  const match = /^([+-]?)(\d*\.?\d+|\d+\.?)(?:e([+-]?\d+))?$/i.exec(text);
  if (!match) throw new Error("Invalid wallet amount");
  const [whole, fraction = ""] = match[2].split(".");
  const exponent = Number(match[3] ?? 0);
  if (Math.abs(exponent) > 400 || fraction.length > 400 || whole.length > 400) throw new Error("Wallet amount out of range");
  let units = BigInt((whole || "0") + fraction) * (match[1] === "-" ? -1n : 1n);
  let scale = fraction.length - exponent;
  if (scale < 0) { units *= 10n ** BigInt(-scale); scale = 0; }
  return {units, scale};
}
function sumWallets(wallets) {
  const parts = wallets.map(wallet => decimalParts(wallet.balance));
  const scale = Math.max(0, ...parts.map(part => part.scale));
  return {units: parts.reduce((sum, part) => sum + part.units * 10n ** BigInt(scale - part.scale), 0n), scale};
}
function formatWallet({units, scale}) {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const cents = scale > 2 ? abs / 10n ** BigInt(scale - 2) : abs * 10n ** BigInt(2 - scale);
  if (abs !== 0n && cents === 0n) return negative ? "-<¥0.01" : "<¥0.01";
  const whole = (cents / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}¥${whole}.${(cents % 100n).toString().padStart(2, "0")}`;
}
export function summarizeBalance(result) {
  if (result === null) return {status: "signed-out"};
  if (result?.status !== "ready") return {status: "failed"};
  try {
    const recharge = result.value.filter(wallet => wallet.currency === "CNY");
    const bonus = result.bonusWallets.filter(wallet => wallet.currency === "CNY");
    if (!recharge.length && !bonus.length) return {status: "no-cny"};
    return {status: "ready", total: formatWallet(sumWallets([...recharge, ...bonus])),
      recharge: formatWallet(sumWallets(recharge)), bonus: formatWallet(sumWallets(bonus))};
  } catch { return {status: "failed"}; }
}

// The account-state stream is long-lived. A Host restart, a Client recompose, or
// a transport hiccup can end it with a terminal error that the Remote stream does
// not retry by itself; without a retry the badge would stay "unavailable" until
// the whole page reloads. Retry with a capped, growing delay instead. Every frame
// received resets the delay, so a stream that recovers stays on the short one.
const DEFAULT_RECONNECT_DELAYS = [5000, 15000, 30000, 60000];

// One shared store across session headers. Account changes invalidate outstanding reads.
export function createBalanceStore(options = {}) {
  const reconnectDelays = Array.isArray(options.reconnectDelays) && options.reconnectDelays.length > 0
    ? options.reconnectDelays : DEFAULT_RECONNECT_DELAYS;
  let snapshot = {status: "unavailable"};
  let remote, metadata, revision = 0, pending, disposed = false, signedIn = false;
  let stream, streamGeneration = 0, reconnectTimer, reconnectAttempt = 0;
  const listeners = new Set();
  const publish = value => { if (!disposed) { snapshot = value; for (const listener of listeners) listener(); } };
  const cancelReconnect = () => {
    if (reconnectTimer !== undefined) {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
  };
  const closeStream = () => {
    const current = stream;
    stream = undefined;
    streamGeneration++;
    if (current !== undefined && typeof current.dispose === "function") {
      try {
        const result = current.dispose();
        if (result !== undefined && typeof result.catch === "function") result.catch(() => {});
      } catch { /* a closed generation cannot fail the store */ }
    }
  };
  const reconnectDelay = () => reconnectDelays[Math.min(reconnectAttempt, reconnectDelays.length - 1)];
  const scheduleReconnect = () => {
    if (disposed || remote === undefined) return;
    cancelReconnect();
    const delay = reconnectDelay();
    reconnectAttempt++;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      openStream();
    }, delay);
  };
  // Open one logical account stream and consume it. A terminal end, a terminal
  // error, or a throw from `$stream` itself all lead to the same retry path.
  const openStream = () => {
    if (disposed || remote === undefined) return;
    cancelReconnect();
    closeStream();
    const generation = streamGeneration;
    let handle;
    try {
      handle = remote.$stream({name: "account", open: signal => remote.account.watch(signal), ended: () => new Error("Account stream ended")});
    } catch {
      if (!disposed && generation === streamGeneration) {
        publish({status: "unavailable"});
        scheduleReconnect();
      }
      return;
    }
    stream = handle;
    void (async () => {
      try {
        for await (const frame of handle) {
          if (disposed || generation !== streamGeneration) return;
          accountChanged(frame.value);
          frame.accept();
        }
      } catch { /* terminal stream failure: retried below instead of latching unavailable */ }
      if (disposed || generation !== streamGeneration) return;
      stream = undefined;
      revision++;
      pending = undefined;
      signedIn = false;
      publish({status: "unavailable"});
      scheduleReconnect();
    })();
  };
  const refresh = () => {
    if (disposed || !remote || !signedIn) return Promise.resolve();
    if (pending) return pending;
    const generation = revision;
    publish({status: "loading"});
    const task = Promise.resolve().then(() => remote.account.getBalance(metadata())).then(result => {
      if (!disposed && generation === revision) publish(result.ok ? summarizeBalance(result.value) : {status: "failed"});
    }).catch(() => { if (!disposed && generation === revision) publish({status: "failed"}); });
    pending = task;
    task.finally(() => { if (pending === task) pending = undefined; });
    return task;
  };
  const accountChanged = view => {
    revision++; pending = undefined;
    reconnectAttempt = 0;
    signedIn = view?.status === "credential-stored";
    publish({status: signedIn ? "loading" : "signed-out"});
    if (signedIn) void refresh();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    refresh,
    /**
     * Retry the account stream now. The badge calls this while it shows
     * "unavailable", where a plain balance read cannot recover the store.
     */
    reconnect() {
      reconnectAttempt = 0;
      openStream();
    },
    connect(api, getMetadata) {
      remote = api; metadata = getMetadata;
      reconnectAttempt = 0;
      openStream();
      const timer = setInterval(() => { void refresh(); }, 60000);
      return () => {
        cancelReconnect();
        revision++;
        pending = undefined;
        signedIn = false;
        remote = undefined;
        clearInterval(timer);
        publish({status: "unavailable"});
        closeStream();
      };
    },
    dispose() {
      disposed = true;
      revision++;
      cancelReconnect();
      closeStream();
      listeners.clear();
    }
  };
}
