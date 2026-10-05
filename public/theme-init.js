// Apply the tiny theme preference before CSS paints. Artwork and the accent are never inverted.
(() => {
  let choice = 'system';
  try { choice = localStorage.getItem('humm-theme') || choice; } catch { /* system default */ }
  const dark = choice === 'dark' || (choice !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
