const CATEGORIES = ['adult', 'gambling', 'social', 'entertainment', 'ads'];

chrome.runtime.onInstalled.addListener(syncState);
chrome.runtime.onStartup.addListener(syncState);

async function syncState() {
  const { categories = {}, customRules = [] } = await chrome.storage.local.get(['categories', 'customRules']);

  const toEnable = CATEGORIES.filter(c => categories[c]).map(c => `${c}_rules`);
  const toDisable = CATEGORIES.filter(c => !categories[c]).map(c => `${c}_rules`);

  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: toEnable,
    disableRulesetIds: toDisable
  });

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map(r => r.id),
    addRules: customRules.map((domain, i) => buildRule(i + 1, domain))
  });
}

function buildRule(id, domain) {
  return {
    id,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: { extensionPath: '/blocked.html' }
    },
    condition: {
      urlFilter: `||${domain}`,
      resourceTypes: ['main_frame']
    }
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'TOGGLE_CATEGORY':
      toggleCategory(message.category, message.enabled).then(sendResponse);
      return true;
    case 'ADD_CUSTOM_URL':
      addCustomUrl(message.domain).then(sendResponse);
      return true;
    case 'REMOVE_CUSTOM_URL':
      removeCustomUrl(message.domain).then(sendResponse);
      return true;
  }
});

async function toggleCategory(category, enabled) {
  const { categories = {} } = await chrome.storage.local.get('categories');
  categories[category] = enabled;
  await chrome.storage.local.set({ categories });

  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: enabled ? [`${category}_rules`] : [],
    disableRulesetIds: enabled ? [] : [`${category}_rules`]
  });

  return { success: true };
}

async function addCustomUrl(domain) {
  const { customRules = [] } = await chrome.storage.local.get('customRules');

  if (customRules.includes(domain)) {
    return { success: false, error: 'Domain is already blocked.' };
  }

  customRules.push(domain);
  await chrome.storage.local.set({ customRules });

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const nextId = existing.length > 0 ? Math.max(...existing.map(r => r.id)) + 1 : 1;

  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [buildRule(nextId, domain)]
  });

  return { success: true };
}

async function removeCustomUrl(domain) {
  const { customRules = [] } = await chrome.storage.local.get('customRules');
  const index = customRules.indexOf(domain);

  if (index === -1) {
    return { success: false, error: 'Domain not found.' };
  }

  customRules.splice(index, 1);
  await chrome.storage.local.set({ customRules });

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const rule = existing.find(r => r.condition.urlFilter === `||${domain}`);

  if (rule) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [rule.id] });
  }

  return { success: true };
}
