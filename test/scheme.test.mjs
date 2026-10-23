import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require = createRequire(import.meta.url);
const peakTime = '2026-10-23T02:00:00Z';
const offpeakTime = '2026-10-23T05:00:00Z';

// Follow the shell marker, independently of OS preferences and wall-clock time.
function load(dark, time = peakTime, noBody = false) {
  let client;
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [time])); }
    static now() { return new Date(time).getTime(); }
  }
  const sandbox = {
    window: {__ModuleLoader__: {load: d => { client = d.factory(require); }}},
    Date: FixedDate, setInterval, clearInterval
  };
  if (dark !== undefined) sandbox.document = {
    body: noBody ? null : {hasAttribute: name => name === 'data-ds-dark-theme' && dark}
  };
  vm.runInNewContext(fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), sandbox);
  return client;
}
const t = (key, args = {}) => key + JSON.stringify(args);
const store = value => ({getSnapshot: () => value, subscribe: () => () => {}, refresh: async () => {}});
const ready = {status: 'ready', total: '¥12.34', recharge: '¥10.00', bonus: '¥2.34'};
function header(client, provider = 'deepseek-official', balance = store(ready)) {
  return renderToStaticMarkup(React.createElement(client.PeakBadge, {
    t, balance, directory: store({status: 'ready', current: null}),
    useProjection: key => key === 'peakCost'
      ? {currency: 'CNY', totalCost: 0.28, messageCosts: {}}
      : {next: {provider, model: 'deepseek-flash'}, lastUsed: null}
  }));
}
function styleOf(html, className) {
  const match = html.match(new RegExp(`class="${className}"[^>]*style="([^"]*)"`));
  assert.ok(match, `missing ${className}`);
  return match[1];
}
function palette(style, background, color, border) {
  assert.ok(style.includes(`background:${background};`), style);
  assert.ok(style.includes(`color:${color};`), style);
  assert.ok(style.includes(`border:1px solid ${border};`), style);
}

test('balance ready palette follows the shell scheme and keeps the amount', () => {
  for (const dark of [false, true]) {
    const html = header(load(dark));
    palette(styleOf(html, 'dsh-peak-indicator-balance'),
      ...(dark ? ['#1b2f24', '#7fd6a8', '#2f5541'] : ['#e8f7ef', '#126b3b', '#a8d9bb']));
    assert.match(html, /¥12.34/);
  }
});

test('every balance status has a readable light and dark palette', () => {
  for (const dark of [false, true]) {
    for (const status of ['loading', 'signed-out', 'failed', 'unavailable', 'no-cny']) {
      const html = header(load(dark), 'deepseek-official', store({status}));
      const colors = status === 'failed'
        ? dark ? ['#332913', '#e8c97b', '#5c4a22'] : ['#fff6e5', '#8a5a00', '#e8c97b']
        : dark ? ['#2b3138', '#9ca3af', '#3f464e'] : ['#f3f4f6', '#5b6470', '#d1d5db'];
      palette(styleOf(html, 'dsh-peak-indicator-balance'), ...colors);
      assert.match(html, new RegExp(`data-status="${status}"`));
      assert.doesNotMatch(html, /¥0\.00/);
    }
  }
});

test('peak headers preserve white text on a red background in both schemes', () => {
  for (const dark of [false, true]) {
    palette(styleOf(header(load(dark, peakTime)), 'dsh-peak-indicator-badge'),
      dark ? '#c93a3f' : '#e5484d', '#ffffff', dark ? '#c93a3f' : '#e5484d');
  }
});

test('off-peak headers use a green palette in both schemes', () => {
  for (const dark of [false, true]) {
    palette(styleOf(header(load(dark, offpeakTime)), 'dsh-peak-indicator-badge'),
      ...(dark ? ['#1b2f24', '#7fd6a8', '#2f5541'] : ['#d9f2e2', '#0f7b3d', '#7fd6a8']));
  }
});

test('third-party headers remain neutral regardless of the current billing period', () => {
  for (const dark of [false, true]) for (const time of [peakTime, offpeakTime]) {
    palette(styleOf(header(load(dark, time), 'openai'), 'dsh-peak-indicator-badge'),
      ...(dark ? ['#2b3138', '#d1d5db', '#3f464e'] : ['#f3f4f6', '#5b6470', '#d1d5db']));
  }
});

test('historical turn chips follow the scheme while retaining their own period and total', () => {
  for (const dark of [false, true]) for (const time of [peakTime, offpeakTime]) {
    const client = load(dark, time);
    for (const [provider, period, colors] of [
      ['deepseek-official', 'peak', [dark ? '#c93a3f' : '#e5484d', '#ffffff', dark ? '#c93a3f' : '#e5484d']],
      ['deepseek-official', 'offpeak', dark ? ['#1b2f24', '#7fd6a8', '#2f5541'] : ['#d9f2e2', '#0f7b3d', '#7fd6a8']],
      ['openai', 'peak', dark ? ['#2b3138', '#d1d5db', '#3f464e'] : ['#f3f4f6', '#5b6470', '#d1d5db']]
    ]) {
      const html = renderToStaticMarkup(React.createElement(client.TurnCost, {
        t, messageId: 'a', useProjection: () => ({currency: 'CNY', messageCosts: {
          a: {provider, model: 'deepseek-flash', period, turn: 1, cost: 0.12},
          b: {provider, model: 'deepseek-flash', period, turn: 1, cost: 0.16},
          c: {provider, model: 'deepseek-flash', period, turn: 2, cost: 9}
        }})
      }));
      palette(styleOf(html, 'dsh-peak-indicator-turn-cost'), ...colors);
      assert.match(html, /0\.28/);
      assert.match(html, /¥/);
    }
  }
});

test('missing document, missing body and a light body safely use the light palette', () => {
  for (const client of [load(undefined), load(false, peakTime, true), load(false)]) {
    palette(styleOf(header(client), 'dsh-peak-indicator-balance'), '#e8f7ef', '#126b3b', '#a8d9bb');
  }
});
