// Sign in, once, after "What music do you like?": Sign in with Apple so HUMM knows who is humming. It can
// be skipped (and done later in Settings). The Apple identity stays on this phone (account.ts).
import '../styles/signin.css';
import { signIn } from '../account';
import { navigate } from '../router';
import { updateSettings } from '../settings';
import { h, toast } from './dom';
import { art, link, mark, titleBlock } from './kit';

/** The first screen after the music question: sign-in where the phone can, otherwise the mic. */
export const afterTaste = (canSignIn: boolean, asked: boolean): string => (canSignIn && !asked ? 'signin' : 'hum');

/** Apple's own button: black, the Apple logo (U+F8FF in Apple's system font) and "Sign in with Apple". */
export function appleButton(onClick: () => void): HTMLButtonElement {
  return h('button', { type: 'button', class: 'btn-apple', onClick },
    h('span', { class: 'apple-logo', 'aria-hidden': 'true' }, ''),
    h('span', null, 'Sign in with Apple'));
}

export function mountSignIn(root: HTMLElement): () => void {
  let alive = true;
  const done = (): void => {
    updateSettings({ signInAsked: true });
    navigate('hum');
  };
  const note = h('p', { class: 'small muted center', 'aria-live': 'polite' }, 'Your Apple ID stays on this phone.');
  const apple = appleButton(() => void go());

  async function go(): Promise<void> {
    apple.disabled = true;
    apple.classList.add('busy');
    const res = await signIn();
    if (!alive) return;
    apple.disabled = false;
    apple.classList.remove('busy');
    if (res === 'ok') {
      toast('Signed in');
      done();
    } else if (res === 'failed') {
      note.textContent = 'Couldn’t sign in with Apple. Skip for now — you can sign in later in Settings.';
    }
  }

  root.append(h('div', { class: 'screen signin' },
    h('header', { class: 'top' }, mark(), link('Skip', done)),
    titleBlock(['Who’s', 'humming?'], { hl: 1, sub: 'Sign in once so HUMM knows you.' }),
    h('div', { class: 'signin-art' }, art('ill-10-headphones')),
    h('div', { class: 'action' }, apple, note)));
  return () => { alive = false; };
}
