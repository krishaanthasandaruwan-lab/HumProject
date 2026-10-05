// First release is account-free; old internal routes return to the mic.
import { navigate } from '../router';
export const afterTaste = (canSignIn: boolean, asked: boolean): string => (canSignIn && !asked ? 'signin' : 'hum');
export function mountSignIn(_root: HTMLElement): () => void {
  navigate('hum');
  return () => undefined;
}
