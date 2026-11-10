const toggleButton = document.querySelector('#toggle');
const status = document.querySelector('#status');

async function refresh() {
  const [{ disguise = 'spreadsheet' }, { panicState }, commands] = await Promise.all([
    chrome.storage.local.get('disguise'), chrome.storage.session.get('panicState'), chrome.commands.getAll()
  ]);
  const selected = [...document.querySelectorAll('input[name="disguise"]')].find((input) => input.value === disguise);
  (selected || document.querySelector('input[value="spreadsheet"]')).checked = true;
  toggleButton.innerHTML = panicState ? '원래 화면으로 복구 <span>↗</span>' : '위장 화면 켜기 <span>↗</span>';
  document.querySelector('#shortcut').textContent = commands.find((command) => command.name === 'toggle-panic')?.shortcut || '지정되지 않음';
}

document.querySelectorAll('input[name="disguise"]').forEach((input) => input.addEventListener('change', () => chrome.storage.local.set({ disguise: input.value })));
document.querySelector('#shortcuts').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));
toggleButton.addEventListener('click', async () => {
  toggleButton.disabled = true;
  try {
    const result = await chrome.runtime.sendMessage({ type: 'toggle' });
    if (!result?.ok) throw new Error(result?.error || '다시 시도해 주세요.');
    window.close();
  } catch (error) { status.textContent = '실행하지 못했습니다. ' + error.message; toggleButton.disabled = false; }
});
refresh().catch((error) => { status.textContent = '설정을 불러오지 못했습니다. ' + error.message; });
