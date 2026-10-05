const whiteNotes = [0, 2, 4, 5, 7, 9, 11];
const names = ['C', 'C sharp', 'D', 'D sharp', 'E', 'F', 'F sharp', 'G', 'G sharp', 'A', 'A sharp', 'B'];
const shortcuts: Record<string, number> = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12 };
const labels = Object.fromEntries(Object.entries(shortcuts).map(([key, note]) => [note, key.toUpperCase()]));
let sound: Promise<typeof import('./pianoSound')> | undefined;

export function initPiano(): void {
  const piano = document.querySelector<HTMLElement>('#piano')!;
  const status = document.querySelector<HTMLElement>('#piano-status')!;
  const octave = document.querySelector<HTMLOutputElement>('#piano-octave')!;
  const down = document.querySelector<HTMLButtonElement>('#octave-down')!;
  const up = document.querySelector<HTMLButtonElement>('#octave-up')!;
  const mute = document.querySelector<HTMLButtonElement>('#piano-mute')!;
  const mobile = matchMedia('(max-width: 620px)');
  let base = 48;
  let muted = false;
  let generation = 0;
  let pianoVisible = false;
  new IntersectionObserver(entries => { pianoVisible = entries.some(e => e.isIntersecting); }).observe(piano);

  function render(): void {
    generation++;
    const count = mobile.matches ? Math.max(7, Math.min(10, Math.floor(innerWidth / 44))) : 28;
    document.querySelector('.piano-caption > p')!.textContent = mobile.matches ? 'Tap the keys. Make a little music.' : 'Tap the keys. Or use A–K.';
    piano.style.setProperty('--whites', String(count));
    piano.replaceChildren();
    for (let index = 0; index < count; index++) {
      const offset = Math.floor(index / 7) * 12 + whiteNotes[index % 7];
      const add = (note: number, black = false): void => {
        const key = document.createElement('button');
        key.className = `piano-key${black ? ' black' : ''}`;
        key.type = 'button';
        key.dataset.offset = String(note);
        key.setAttribute('aria-label', `Play ${names[(base + note) % 12]}${Math.floor((base + note) / 12) - 1}`);
        if (black) key.style.setProperty('--left', `${(index + 1 - .31) / count * 100}%`);
        if (labels[note]) { const label = document.createElement('span'); label.className = 'key-label'; label.textContent = labels[note]; key.append(label); }
        key.addEventListener('pointerdown', event => {
          if (event.button !== 0) return;
          key.setPointerCapture(event.pointerId);
          void press(key);
        });
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => key.addEventListener(type, () => key.classList.remove('pressed')));
        key.addEventListener('click', event => { if (event.detail === 0) void press(key).then(() => setTimeout(() => key.classList.remove('pressed'), 180)); });
        piano.append(key);
      };
      add(offset);
      if (index < count - 1 && [0, 2, 5, 7, 9].includes(offset % 12)) add(offset + 1, true);
    }
    const last = base + Math.floor((count - 1) / 7) * 12 + whiteNotes[(count - 1) % 7];
    octave.value = `C${base / 12 - 1}–${names[last % 12]}${Math.floor(last / 12) - 1}`;
    down.disabled = base <= 24;
    up.disabled = base >= 72;
  }
  async function press(key: HTMLButtonElement): Promise<void> {
    key.classList.add('pressed');
    if (muted) return;
    if (['opening', 'recording', 'processing'].includes(document.querySelector<HTMLElement>('#demo-studio')!.dataset.state!)) { status.textContent = 'Finish or cancel your recording before playing the piano.'; return; }
    const note = base + Number(key.dataset.offset);
    const version = generation;
    try {
      const audio = await (sound ??= import('./pianoSound').catch(error => { sound = undefined; throw error; }));
      if (muted || version !== generation || document.hidden) return;
      await audio.pianoNote(note);
    } catch { status.textContent = 'Piano audio could not start. Tap a key to try again.'; }
  }
  document.addEventListener('keydown', event => {
    const keyName = event.key.toLowerCase();
    if (!pianoVisible || !Object.hasOwn(shortcuts, keyName) || event.repeat || event.ctrlKey || event.metaKey || event.altKey || document.querySelector('dialog[open]')) return;
    if ((event.target as HTMLElement).closest('input,select,textarea,[contenteditable],button:not(.piano-key),a')) return;
    const key = piano.querySelector<HTMLButtonElement>(`[data-offset="${shortcuts[keyName]}"]`);
    if (!key) return;
    event.preventDefault(); void press(key);
  });
  document.addEventListener('keyup', event => {
    piano.querySelector(`[data-offset="${shortcuts[event.key.toLowerCase()]}"]`)?.classList.remove('pressed');
  });
  const release = (): void => { generation++; piano.querySelectorAll('.pressed').forEach(key => key.classList.remove('pressed')); };
  window.addEventListener('blur', release);
  document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });
  down.addEventListener('click', () => { base = Math.max(24, base - 12); render(); });
  up.addEventListener('click', () => { base = Math.min(72, base + 12); render(); });
  mute.addEventListener('click', () => { muted = !muted; void sound?.then(audio => audio.setPianoMuted(muted)).catch(() => undefined); mute.setAttribute('aria-pressed', String(muted)); mute.setAttribute('aria-label', muted ? 'Unmute piano' : 'Mute piano'); mute.querySelector('use')!.setAttribute('href', muted ? '#i-mute' : '#i-volume'); });
  mobile.addEventListener('change', render);
  render();
}
