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

// One shared store across session headers. Account changes invalidate outstanding reads.
export function createBalanceStore() {
  let snapshot = {status: "unavailable"};
  let remote, metadata, revision = 0, pending, disposed = false, signedIn = false;
  const listeners = new Set();
  const publish = value => { if (!disposed) { snapshot = value; for (const listener of listeners) listener(); } };
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
    signedIn = view?.status === "credential-stored";
    publish({status: signedIn ? "loading" : "signed-out"});
    if (signedIn) void refresh();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    refresh,
    connect(api, getMetadata) {
      remote = api; metadata = getMetadata;
      const stream = api.$stream({name: "account", open: signal => api.account.watch(signal), ended: () => new Error("Account stream ended")});
      let connected = true;
      void (async () => {
        try {
          for await (const frame of stream) {
            if (!connected || disposed) break;
            accountChanged(frame.value);
            frame.accept();
          }
        } catch { /* The next watch snapshot refreshes after reconnection. */ }
        if (connected && !disposed) { revision++; pending = undefined; signedIn = false; publish({status: "unavailable"}); }
      })();
      const timer = setInterval(() => { void refresh(); }, 60000);
      return () => { connected = false; revision++; pending = undefined; signedIn = false; remote = undefined; clearInterval(timer); publish({status: "unavailable"}); return stream.dispose(); };
    },
    dispose() { disposed = true; revision++; listeners.clear(); }
  };
}
