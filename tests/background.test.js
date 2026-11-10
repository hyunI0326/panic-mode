const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function setup({ failCreate = false, disguise = 'code' } = {}) {
  let created;
  const session = {};
  const tabs = new Map([
    [11, { id: 11, mutedInfo: { muted: false } }],
    [12, { id: 12, mutedInfo: { muted: true, reason: 'user' } }],
    [21, { id: 21, mutedInfo: { muted: false } }]
  ]);
  const windows = new Map([
    [1, { id: 1, state: 'maximized', focused: true, tabs: [tabs.get(11), tabs.get(12)] }],
    [2, { id: 2, state: 'minimized', focused: false, tabs: [tabs.get(21)] }]
  ]);
  const listeners = {};
  const chrome = {
    runtime: { id: 'test-extension', getURL: (url) => 'chrome-extension://test/' + url, onMessage: { addListener: (fn) => { listeners.message = fn; } } },
    commands: { onCommand: { addListener: (fn) => { listeners.command = fn; } } },
    storage: {
      session: { get: async (key) => ({ [key]: structuredClone(session[key]) }), set: async (obj) => Object.assign(session, structuredClone(obj)), remove: async (key) => { delete session[key]; } },
      local: { get: async () => ({ disguise }) }
    },
    tabs: {
      get: async (id) => { if (!tabs.has(id)) throw Error('closed'); return tabs.get(id); },
      update: async (id, props) => { const tab = tabs.get(id); if (!tab) throw Error('closed'); tab.mutedInfo = { muted: props.muted, reason: 'extension', extensionId: 'test-extension' }; },
      remove: async (id) => { tabs.delete(id); }
    },
    windows: {
      getAll: async () => [...windows.values()].map((window) => structuredClone(window)),
      create: async (options) => {
        if (failCreate) throw Error('create failed');
        created = options;
        const tab = { id: 31, mutedInfo: { muted: false } };
        tabs.set(31, tab);
        const window = { id: 3, state: 'normal', tabs: [tab] };
        windows.set(3, window);
        return window;
      },
      update: async (id, props) => { const window = windows.get(id); if (!window) throw Error('closed'); Object.assign(window, props); },
      onRemoved: { addListener: (fn) => { listeners.removed = fn; } }
    }
  };
  const context = vm.createContext({ chrome, console });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../background.js'), 'utf8'), context);
  return { context, tabs, windows, session, listeners, getCreated: () => created };
}

test('toggle restores window states and only its own mutes', async () => {
  const { context, tabs, windows, session } = setup();
  await vm.runInContext('toggle()', context);
  assert.equal(windows.get(1).state, 'minimized');
  assert.equal(windows.get(2).state, 'minimized');
  assert.equal(tabs.get(11).mutedInfo.muted, true);
  assert.equal(tabs.get(21).mutedInfo.muted, true);
  assert.ok(session.panicState);
  tabs.get(21).mutedInfo = { muted: true, reason: 'user' };
  await vm.runInContext('toggle()', context);
  assert.equal(windows.get(1).state, 'maximized');
  assert.equal(windows.get(2).state, 'minimized');
  assert.equal(tabs.get(11).mutedInfo.muted, false);
  assert.equal(tabs.get(12).mutedInfo.muted, true);
  assert.equal(tabs.get(21).mutedInfo.muted, true);
  assert.equal(tabs.has(31), false);
  assert.equal(session.panicState, undefined);
});

test('closing the disguise window restores original state', async () => {
  const { context, tabs, windows, session, listeners } = setup();
  await vm.runInContext('toggle()', context);
  windows.delete(3);
  tabs.delete(31);
  await listeners.removed(3);
  assert.equal(windows.get(1).state, 'maximized');
  assert.equal(tabs.get(11).mutedInfo.muted, false);
  assert.equal(session.panicState, undefined);
});

test('a failed disguise window creation rolls back mutes', async () => {
  const { context, tabs, windows, session } = setup({ failCreate: true });
  await assert.rejects(vm.runInContext('toggle()', context), /create failed/);
  assert.equal(tabs.get(11).mutedInfo.muted, false);
  assert.equal(tabs.get(12).mutedInfo.muted, true);
  assert.equal(windows.get(1).state, 'maximized');
  assert.equal(session.panicState, undefined);
});

for (const view of ['ios', 'windows']) {
  test(view + ' update opens fullscreen and restores normally', async () => {
    const { context, tabs, windows, getCreated } = setup({ disguise: view });
    await vm.runInContext('toggle()', context);
    assert.match(getCreated().url, new RegExp('view=' + view + '$'));
    assert.equal(getCreated().state, 'fullscreen');
    assert.equal(getCreated().type, 'popup');
    await vm.runInContext('toggle()', context);
    assert.equal(windows.get(1).state, 'maximized');
    assert.equal(tabs.get(11).mutedInfo.muted, false);
  });
}

test('unknown disguise falls back to spreadsheet', async () => {
  const { context, getCreated } = setup({ disguise: 'unknown' });
  await vm.runInContext('toggle()', context);
  assert.match(getCreated().url, /view=spreadsheet$/);
  assert.equal(getCreated().state, undefined);
  assert.equal(getCreated().type, 'normal');
});

for (const view of ['ios', 'windows']) {
  test(view + ' update displays only its own screen', () => {
    const elements = Object.fromEntries(['sheet', 'code', 'ios', 'windows'].map((name) => ['#' + name + '-view', { hidden: false }]));
    const document = { querySelector: (selector) => elements[selector], title: '' };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../disguise.js'), 'utf8'), {
      document, location: { search: '?view=' + view }, URLSearchParams
    });
    for (const name of ['sheet', 'code', 'ios', 'windows']) {
      assert.equal(elements['#' + name + '-view'].hidden, name !== view);
    }
  });
}
