// Monthly Plus and Pro, with a verified Apple introductory trial when available.
import { buySubscription, canBuy, isNative, MANAGE_URL, PRIVACY_URL, subscriptionPlan, restorePro, restoreMessage, storeUrl, TERMS_URL, type StorePlan } from '../pro/billing';
import { currentTier, type PaidTier } from '../pro/pro';
import { reload } from '../router';
import { h, segmented, sheet, toast } from './dom';
import { icon, type IconName } from './icons';
import { art, iconBtn, link, mainBtn, setLabel } from './kit';
import { INSTRUMENTS, KITS } from '../synth/kits';

const PERKS: Record<PaidTier, [IconName, string][]> = { pro: [
  ['share', 'Export every song in high quality'],
  ['sparkles', 'Every version of every hum'],
  ['fix', 'Tracks and Fix for production exports'],
  ['drums', `All ${KITS.length} drum kits and ${INSTRUMENTS.length} instruments`],
  ['midi', 'MIDI files, no watermark'],
  ['mic', 'Studio recordings and imports up to 3 minutes'],
], plus: [
  ['sparkles', 'Export extra versions from More'],
  ['drums', `All ${KITS.length} kits and ${INSTRUMENTS.length} instruments`],
  ['voice', 'Voice effect in the songs you export'],
  ['video', '1080p video without the HUMM watermark'],
  ['mic', 'Studio recordings and imports up to 90 seconds'],
  ['tracks', 'Tracks, Fix and MIDI require Pro'],
] };

/** Red confetti squares fall once (skipped with Reduce Motion). */
export function confetti(): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = h('div', { class: 'confetti', 'aria-hidden': 'true' });
  for (let i = 0; i < 36; i++) {
    const s = h('i', { style: `left:${Math.random() * 100}%;width:${6 + Math.random() * 8}px;height:${6 + Math.random() * 8}px;${i % 4 === 0 ? 'background:var(--ink)' : ''}` });
    layer.append(s);
    s.animate([{ transform: 'translateY(-20px) rotate(0)' }, { transform: `translateY(${innerHeight + 40}px) rotate(${360 + Math.random() * 360}deg)` }],
      { duration: 900 + Math.random() * 600, delay: Math.random() * 250, easing: 'cubic-bezier(.3,.6,.6,1)', fill: 'both' });
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 1800);
}

export function openPaywall(reason?: string, initial: PaidTier = 'pro'): void {
  let selected = initial;
  let quote: StorePlan | null = null;
  let request = 0;
  let busy = false;
  const buy = mainBtn(canBuy() ? 'Loading price…' : isNative() ? 'Store not available' : 'Get Pro in the app', undefined, { icon: 'pro' });
  buy.disabled = isNative();
  let alive = true;
  const restore = link('Restore purchases');
  const title = h('h2', { class: 'h1' });
  const perks = h('ul', { class: 'perks' });
  const price = h('p', { class: 'body center', 'aria-live': 'polite' });
  const selector = segmented<PaidTier>([{ value: 'plus', label: 'Plus' }, { value: 'pro', label: 'Pro' }], selected, (tier) => {
    if (busy) return;
    selected = tier; selector.set(tier); void showPlan();
  }, 'Membership');
  const external = (url: string, text: string): HTMLAnchorElement => h('a', { class: 'link', href: url, target: '_blank', rel: 'noopener noreferrer' }, text);
  const content = h('div', { class: 'paywall' },
    h('div', { class: 'row' }, selector.el, h('span', { class: 'grow' }), iconBtn('close', 'Close', () => close(), { ghost: true })),
    title,
    art('ill-09-pro', 0.8),
    reason ? h('p', { class: 'body muted' }, reason) : null,
    perks, price, buy,
    h('p', { class: 'small muted center' }, 'Monthly subscription. Payment is charged to your store account after purchase confirmation or the free trial. It renews automatically unless cancelled at least 24 hours before the current period ends. Manage or cancel in your store account settings.'),
    h('div', { class: 'row wrap' }, restore, external(MANAGE_URL, 'Manage subscriptions'), external(TERMS_URL, 'Terms of Use'), PRIVACY_URL ? external(PRIVACY_URL, 'Privacy policy') : null),
    h('div', { class: 'piano-band', 'aria-hidden': 'true' }));
  const close = sheet(content, () => { alive = false; }, 'Membership');

  async function showPlan(): Promise<void> {
    const token = ++request, tier = selected;
    quote = null;
    title.replaceChildren('Choose ', h('span', { class: 'hl' }, tier === 'plus' ? 'Plus' : 'Pro'));
    perks.replaceChildren(...PERKS[tier].map(([ic, text]) => h('li', null, h('span', { class: 'tile48' }, icon(ic, 22)), h('span', { class: 'body' }, text))));
    buy.disabled = isNative();
    setLabel(buy, canBuy() ? 'Loading price…' : isNative() ? 'Store not available' : 'Get membership in the app');
    price.textContent = canBuy() ? 'Checking the store…' : 'Plans are available through the app store once configured.';
    if (!canBuy()) return;
    const plan = await subscriptionPlan(tier);
    if (!alive || token !== request) return;
    quote = plan;
    const owned = currentTier() === tier || currentTier() === 'pro';
    price.textContent = plan ? plan.trial ? `3 months free, then ${plan.price}/month. Full Pro access. Cancel before the trial ends to avoid a charge.` : `${plan.price}/month. Renews monthly until cancelled.` : 'The store is unavailable. Please try again later.';
    setLabel(buy, owned ? 'Current membership' : plan?.trial ? 'Start 3 months free' : plan ? `Subscribe · ${plan.price}/month` : 'Store not available');
    buy.disabled = !plan || owned;
  }
  void showPlan();

  const unlocked = (): void => {
    navigator.vibrate?.(20);
    confetti();
    toast(`Welcome to ${currentTier() === 'plus' ? 'Plus' : 'Pro'}`);
    close();
    reload();
  };

  buy.addEventListener('click', async () => {
    if (!canBuy()) {
      if (!isNative() && storeUrl()) window.open(storeUrl(), '_blank', 'noopener');
      else toast('The app listing is not available yet.');
      return;
    }
    if (busy || !quote) return;
    busy = true;
    buy.disabled = true;
    restore.disabled = true;
    selector.el.querySelectorAll('button').forEach((button) => { button.disabled = true; });
    buy.classList.add('busy');
    const res = await buySubscription(quote);
    if (!alive) return;
    busy = false;
    restore.disabled = false;
    selector.el.querySelectorAll('button').forEach((button) => { button.disabled = false; });
    buy.classList.remove('busy');
    if (res === 'ok') unlocked();
    else if (res === 'unavailable') toast('Can’t reach the store. Try again.');
    else if (res === 'error') toast('The purchase didn’t go through.');
    else if (res === 'pending') toast('Your purchase is awaiting approval.');
    else if (res === 'changed') toast('The price or trial changed. Review the updated plan before subscribing.');
    if (res !== 'ok') void showPlan();
  });
  restore.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    buy.disabled = true;
    restore.disabled = true;
    const result = await restorePro();
    if (!alive) return;
    restore.disabled = false;
    busy = false;
    if (result === 'ok') unlocked();
    else { toast(restoreMessage(result)); void showPlan(); }
  });
}
