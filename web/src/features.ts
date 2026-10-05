import './common';

const image = document.querySelector<HTMLImageElement>('#story-image')!;
const frame = image.parentElement!;
const descriptions: Record<string, string> = {
  'hum-current': 'HUMM microphone screen captured on iPhone',
  studio: 'HUMM Studio with drums, bass, melody, chords and your voice',
  drums: 'HUMM drum editor with editable kick, snare and hi-hat hits',
};
let request = 0;
document.querySelectorAll<HTMLDetailsElement>('.story-steps details').forEach(step => {
  step.addEventListener('toggle', async () => {
    if (!step.open) return;
    const version = ++request;
    const name = step.dataset.preview!;
    const next = new Image();
    next.src = `${import.meta.env.BASE_URL}screens/${name}.png`;
    try { await next.decode(); } catch { return; }
    if (version !== request || !step.open) return;
    image.src = next.src;
    image.alt = descriptions[name];
    frame.classList.remove('changing');
    requestAnimationFrame(() => frame.classList.add('changing'));
  });
});
