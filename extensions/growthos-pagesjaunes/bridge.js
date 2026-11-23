/* Pont limité à GrowthOS : aucun jeton ni cookie n'est lu par l'extension. */
(() => {
  if (window.top !== window) return;
  const CHANNEL = 'growthos-pagesjaunes-device-v1';
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || data.channel !== CHANNEL || data.direction !== 'to-extension') return;
    if (typeof data.requestId !== 'string' || data.requestId.length > 80 || !['ping', 'search'].includes(data.action)) return;
    chrome.runtime.sendMessage({ action: data.action, payload: data.payload }, (response) => {
      const failure = chrome.runtime.lastError?.message;
      window.postMessage({
        channel: CHANNEL, direction: 'from-extension', requestId: data.requestId,
        ok: !failure && response?.ok === true,
        results: response?.results || [],
        warnings: response?.warnings || [],
        error: failure || response?.error || null,
      }, window.location.origin);
    });
  });
  window.postMessage({ channel: CHANNEL, direction: 'from-extension', action: 'ready' }, window.location.origin);
})();
