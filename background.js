const STATE_KEY = 'panicState';
let busy = false;

async function restore(state) {
  // Only undo mutes that are still attributed to this extension.
  await Promise.all(state.mutedTabIds.map(async (id) => {
    try {
      const tab = await chrome.tabs.get(id);
      if (tab.mutedInfo?.muted && tab.mutedInfo.reason === 'extension' && tab.mutedInfo.extensionId === chrome.runtime.id) {
        await chrome.tabs.update(id, { muted: false });
      }
    } catch (_) { /* The tab may have been closed. */ }
  }));
  for (const window of state.windows) {
    try { await chrome.windows.update(window.id, { state: window.state }); } catch (_) { /* The window may have been closed. */ }
  }
  if (state.focusedWindowId) {
    try { await chrome.windows.update(state.focusedWindowId, { focused: true }); } catch (_) { /* The window may have been closed. */ }
  }
  if (state.disguiseTabId) {
    try { await chrome.tabs.remove(state.disguiseTabId); } catch (_) { /* It may already be closed. */ }
  }
  await chrome.storage.session.remove(STATE_KEY);
}

async function toggle() {
  if (busy) return;
  busy = true;
  try {
    const stored = await chrome.storage.session.get(STATE_KEY);
    if (stored[STATE_KEY]) {
      await restore(stored[STATE_KEY]);
      return;
    }
    const windows = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
    const visible = windows.filter((window) => window.state !== 'minimized');
    const focused = windows.find((window) => window.focused);
    const state = {
      windows: visible.map(({ id, state }) => ({ id, state: state === 'fullscreen' ? 'fullscreen' : state === 'maximized' ? 'maximized' : 'normal' })),
      focusedWindowId: focused?.id,
      mutedTabIds: windows.flatMap((window) => window.tabs.filter((tab) => !tab.mutedInfo?.muted).map((tab) => tab.id))
    };
    await chrome.storage.session.set({ [STATE_KEY]: state });
    try {
      await Promise.all(state.mutedTabIds.map(async (id) => {
        try { await chrome.tabs.update(id, { muted: true }); } catch (_) { /* A tab may have been closed. */ }
      }));
      const { disguise = 'spreadsheet' } = await chrome.storage.local.get('disguise');
      const view = ['spreadsheet', 'code', 'ios', 'windows'].includes(disguise) ? disguise : 'spreadsheet';
      const url = chrome.runtime.getURL('disguise.html?view=' + view);
      const updateScreen = view === 'ios' || view === 'windows';
      const window = await chrome.windows.create({ url, type: updateScreen ? 'popup' : 'normal', focused: true, ...(updateScreen ? { state: 'fullscreen' } : {}) });
      state.disguiseWindowId = window.id;
      state.disguiseTabId = window.tabs[0].id;
      await chrome.storage.session.set({ [STATE_KEY]: state });
      await Promise.all(visible.map(async ({ id }) => {
        try { await chrome.windows.update(id, { state: 'minimized' }); } catch (_) { /* A window may have been closed. */ }
      }));
      await chrome.windows.update(window.id, { focused: true });
    } catch (error) {
      await restore(state);
      throw error;
    }
  } finally {
    busy = false;
  }
}

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-panic') toggle().catch(console.error);
});
chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message?.type !== 'toggle') return;
  toggle().then(() => respond({ ok: true }), (error) => respond({ ok: false, error: error.message }));
  return true;
});
chrome.windows.onRemoved.addListener(async (id) => {
  const { [STATE_KEY]: state } = await chrome.storage.session.get(STATE_KEY);
  if (state?.disguiseWindowId === id && !busy) {
    busy = true;
    try { await restore(state); } catch (error) { console.error(error); } finally { busy = false; }
  }
});
