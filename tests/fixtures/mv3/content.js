// SPDX-License-Identifier: MPL-2.0
chrome.runtime.sendMessage({ type: 'fixture' }, response => {
  document.documentElement.dataset.nativeExtension = response?.message ?? 'no response';
});
