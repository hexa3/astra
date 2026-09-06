chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.type === 'fixture') {
    chrome.storage.local.set({ verified: true }).then(() => respond({ message: 'native MV3 worker' }));
    return true;
  }
});
