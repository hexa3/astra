chrome.runtime.sendMessage({ type: 'fixture' }, response => {
  document.documentElement.dataset.nativeExtension = response?.message ?? 'no response';
});
