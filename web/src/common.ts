import { site } from './site';

const dialog = document.querySelector<HTMLDialogElement>('#store-dialog')!;
document.querySelectorAll<HTMLButtonElement>('[data-store]').forEach(button => {
  button.addEventListener('click', () => {
    if (site.appStoreUrl) window.open(site.appStoreUrl, '_blank', 'noopener,noreferrer');
    else dialog.showModal();
  });
});
dialog.querySelector('.dialog-close')!.addEventListener('click', () => dialog.close());
dialog.querySelector('#store-try')!.addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const box = dialog.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
});
const contact = document.querySelector<HTMLAnchorElement>('#contact-email');
if (site.contactEmail && contact) {
  contact.href = `mailto:${site.contactEmail}`;
  contact.textContent = site.contactEmail;
  contact.hidden = false;
}

const menu = document.querySelector<HTMLButtonElement>('#menu-toggle')!;
const header = document.querySelector<HTMLElement>('.site-header')!;
dialog.addEventListener('close', () => { if (menu.offsetParent) menu.focus(); });
const closeMenu = (): void => { menu.setAttribute('aria-expanded', 'false'); header.classList.remove('menu-open'); };
menu.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  header.classList.toggle('menu-open', open);
});
header.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { closeMenu(); menu.focus(); }
});
header.querySelectorAll('nav a, [data-store]').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('click', event => { if (!header.contains(event.target as Node)) closeMenu(); });
matchMedia('(min-width: 701px)').addEventListener('change', closeMenu);
const page = location.pathname.split('/').pop() || 'index.html';
header.querySelectorAll<HTMLAnchorElement>('nav a').forEach(link => {
  if (link.getAttribute('href') === `./${page}`) link.setAttribute('aria-current', 'page');
});

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let reveals: IntersectionObserver | undefined;
const setMotion = (): void => {
  reveals?.disconnect();
  document.body.classList.toggle('motion-ready', !reducedMotion.matches);
  if (reducedMotion.matches) return;
  reveals = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); reveals!.unobserve(entry.target); }
    });
  }, { threshold: .08 });
  document.querySelectorAll('.reveal:not(.is-visible)').forEach(el => reveals!.observe(el));
};
setMotion();
reducedMotion.addEventListener('change', setMotion);

// A small depth shift follows normal scrolling; no pinned sections or continuous loop.
const phones = document.querySelector<HTMLElement>('.hero-phones');
if (phones) {
  let frame = 0;
  const paint = (): void => {
    frame = 0;
    const box = phones.getBoundingClientRect();
    const drift = reducedMotion.matches || innerWidth <= 700 ? 0 : Math.max(-12, Math.min(12, -box.top * .035));
    phones.style.setProperty('--drift', `${drift}px`);
  };
  const requestPaint = (): void => { if (!frame) frame = requestAnimationFrame(paint); };
  addEventListener('scroll', requestPaint, { passive: true });
  addEventListener('resize', requestPaint);
  reducedMotion.addEventListener('change', requestPaint);
  paint();
}
