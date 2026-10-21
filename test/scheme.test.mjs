import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require = createRequire(import.meta.url);

/**
 * Load a fresh client bundle inside a sandbox that optionally exposes a
 * `body[data-ds-dark-theme]` marker, which is how ui-layout publishes the
 * resolved color scheme. The badge must follow that marker and never infer the
 * scheme from the clock or from `prefers-color-scheme`.
 */
function load(dark) {
  let client;
  const body = {
    hasAttribute: (name) => name === 'data-ds-dark-theme' && dark
  };
  const sandbox = {
    window: {__ModuleLoader__: {load: (d) => { client = d.factory(require); }}},
    Date, setInterval, clearInterval
  };
  if (dark !== undefined) sandbox.document = {body};
  vm.runInNewContext(fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), sandbox);
  return client;
}

const t = (key, args = {}) => (args ? key : key);
const store = (value) => ({getSnapshot: () => value, subscribe: () => () => {}, refresh: async () => {}});
const ready = {status: 'ready', total: '¥12.34', recharge: '¥10.00', bonus: '¥2.34'};

function header(client, provider = 'deepseek-official', balance = store(ready)) {
  return renderToStaticMarkup(React.createElement(client.PeakBadge, {
    t, balance,
    directory: store({status: 'ready', current: null}),
    useProjection: (key) => key === 'peakCost'
      ? {currency: 'CNY', totalCost: 0.28, messageCosts: {}}
      : {next: provider ? {provider, model: 'deepseek-flash'} : null, lastUsed: null}
  }));
}

function styleOf(html, className) {
  const match = html.match(new RegExp(`class="${className}"[^>]*style="([^"]*)"`));
  assert.ok(match, `missing ${className}`);
  return match[1];
}

test('dark scheme repaints the balance badge instead of keeping the light fill', () => {
  const light = styleOf(header(load(false)), 'dsh-peak-indicator-balance');
  const dark = styleOf(header(load(true)), 'dsh-peak-indicator-balance');
  assert.match(light, /background:#e8f7ef/);
  assert.match(dark, /background:#1b2f24/);
  assert.notEqual(light, dark);
  assert.doesNotMatch(dark, /#e8f7ef|#fff6e5|#f3f4f6/);
});

test('dark scheme repaints every balance status, including the failure and idle fills', () => {
  for (const status of ['loading', 'signed-out', 'failed', 'unavailable', 'no-cny']) {
    const dark = styleOf(header(load(true), 'deepseek-official', store({status})), 'dsh-peak-indicator-balance');
    assert.doesNotMatch(dark, /#e8f7ef|#fff6e5|#f3f4f6/, status);
  }
});

test('dark scheme keeps the peak pill legible and recolors off-peak and neutral', () => {
  const darkClient = load(true);
  const dark = styleOf(header(darkClient), 'dsh-peak-indicator-badge');
  const light = styleOf(header(load(false)), 'dsh-peak-indicator-badge');
  assert.doesNotMatch(dark, /#d9f2e2|#fff|#f3f4f6/);
  assert.notEqual(light, dark);
  // Third-party routes use the neutral pill, which must also be repainted.
  const neutral = styleOf(header(darkClient, 'openai'), 'dsh-peak-indicator-badge');
  assert.match(neutral, /background:#2b3138/);
  assert.doesNotMatch(neutral, /background:#f3f4f6/);
});

test('a missing document or body falls back to the light palette without throwing', () => {
  for (const dark of [undefined, false]) {
    const html = header(load(dark));
    assert.match(styleOf(html, 'dsh-peak-indicator-balance'), /background:#e8f7ef/);
  }
  const noBody = load(undefined);
  assert.match(styleOf(header(noBody), 'dsh-peak-indicator-balance'), /background:#e8f7ef/);
});
