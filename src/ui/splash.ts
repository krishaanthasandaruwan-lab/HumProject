// 01 · Splash hand-over: once the app is ready (and the splash has had its moment), the logo mark flies
// into the mic button and becomes it. Anywhere else, the splash just fades.
const MIN_MS = 1500;

function fade(el: HTMLElement): void {
  el.style.transition = 'opacity .3s ease';
  el.style.opacity = '0';
  setTimeout(() => el.remove(), 320);
}

async function fly(el: HTMLElement): Promise<void> {
  const mark = el.querySelector<SVGSVGElement>('.mark');
  const mic = document.getElementById('hum-mic');
  if (!mark || !mic || matchMedia('(prefers-reduced-motion: reduce)').matches) return fade(el);
  // Titles shift once Anton arrives; measure after it has (or after a short wait).
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 600))]);
  const a = mark.getBoundingClientRect();
  const b = mic.getBoundingClientRect();
  if (!b.width) return fade(el);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const s = b.width / a.width;
  const ease = 'cubic-bezier(.2,.8,.2,1)';
  mic.style.opacity = '0';
  el.classList.add('out');
  mark.animate(
    [
      { transform: 'none', clipPath: 'inset(0 round 0%)' },
      { transform: `translate(${dx}px, ${dy}px) scale(${s})`, clipPath: 'inset(0 round 50%)', offset: 0.85 },
      { transform: `translate(${dx}px, ${dy}px) scale(${s})`, clipPath: 'inset(0 round 50%)', opacity: 0 },
    ],
    { duration: 520, easing: ease, fill: 'forwards' },
  );
  const show = mic.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: 380, fill: 'forwards' });
  show.onfinish = () => {
    mic.style.opacity = '';
    show.cancel();
    el.remove();
  };
}

/** Called once the first screen is on: hand over from the splash to it. */
export function hideSplash(): void {
  const el = document.getElementById('splash');
  if (!el) return;
  setTimeout(() => void fly(el), Math.max(0, MIN_MS - performance.now()));
}
