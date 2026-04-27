const CATEGORIES = ['adult', 'gambling', 'social', 'entertainment'];

document.addEventListener('DOMContentLoaded', async () => {
  const { categories = {}, customRules = [] } = await chrome.storage.local.get(['categories', 'customRules']);

  for (const cat of CATEGORIES) {
    const checkbox = document.getElementById(`cat-${cat}`);
    if (checkbox) {
      checkbox.checked = !!categories[cat];
      checkbox.addEventListener('change', () => onCategoryToggle(cat, checkbox.checked));
    }
  }

  renderCustomList(customRules);

  document.getElementById('addBtn').addEventListener('click', onAddUrl);
  document.getElementById('urlInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') onAddUrl();
  });
});

async function onCategoryToggle(category, enabled) {
  await chrome.runtime.sendMessage({ type: 'TOGGLE_CATEGORY', category, enabled });
}

async function onAddUrl() {
  const input = document.getElementById('urlInput');
  const errorMsg = document.getElementById('errorMsg');
  const raw = input.value.trim().toLowerCase();

  errorMsg.textContent = '';

  if (!raw) return;

  const domain = normalizeDomain(raw);

  if (!isValidDomain(domain)) {
    errorMsg.textContent = 'Please enter a valid domain (e.g., example.com).';
    return;
  }

  const result = await chrome.runtime.sendMessage({ type: 'ADD_CUSTOM_URL', domain });

  if (!result.success) {
    errorMsg.textContent = result.error;
    return;
  }

  input.value = '';
  const { customRules = [] } = await chrome.storage.local.get('customRules');
  renderCustomList(customRules);
}

async function onRemoveUrl(domain) {
  await chrome.runtime.sendMessage({ type: 'REMOVE_CUSTOM_URL', domain });
  const { customRules = [] } = await chrome.storage.local.get('customRules');
  renderCustomList(customRules);
}

function renderCustomList(rules) {
  const container = document.getElementById('customList');
  container.innerHTML = '';

  if (rules.length === 0) {
    container.innerHTML = '<div class="empty-msg">No custom sites blocked yet.</div>';
    return;
  }

  for (const domain of rules) {
    const item = document.createElement('div');
    item.className = 'blocked-item';

    const label = document.createElement('span');
    label.className = 'blocked-domain';
    label.textContent = domain;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.title = 'Remove';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => onRemoveUrl(domain));

    item.appendChild(label);
    item.appendChild(removeBtn);
    container.appendChild(item);
  }
}

function normalizeDomain(input) {
  try {
    const withScheme = input.startsWith('http') ? input : `https://${input}`;
    return new URL(withScheme).hostname.replace(/^www\./, '');
  } catch {
    return input.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  }
}

function isValidDomain(domain) {
  return /^[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?)+$/.test(domain);
}
