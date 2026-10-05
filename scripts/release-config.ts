/** Shared by the CLI check and Vite's release build; process environment overrides dotenv files. */
export function releaseProblems(env: Record<string, string | undefined>): string[] {
  const problems: string[] = [];
  const key = env.VITE_REVENUECAT_IOS_KEY ?? '';
  if (!/^appl_[A-Za-z0-9]{10,}$/.test(key) || /x{5}|placeholder|example/i.test(key)) problems.push('Set a real App Store RevenueCat public SDK key.');
  if (env.VITE_DEV_PRO === 'true') problems.push('VITE_DEV_PRO must be false for a store release.');
  const policy = env.VITE_PRIVACY_POLICY_URL ?? '';
  try {
    const url = new URL(policy);
    if (url.protocol !== 'https:' || url.username || url.password || /^(localhost|127\.|0\.)/.test(url.hostname) || /example\.(com|org|net)$/.test(url.hostname)) throw new Error();
  } catch { problems.push('Set a public HTTPS privacy-policy URL.'); }
  const email = env.VITE_SUPPORT_EMAIL ?? '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /@example\.(com|org|net)$/.test(email)) problems.push('Set the real support email.');
  if (!/^[A-Za-z0-9._-]+$/.test(env.VITE_PRO_ENTITLEMENT || 'pro')) problems.push('The Pro entitlement identifier is invalid.');
  if (!/^[A-Za-z0-9._-]+$/.test(env.VITE_PRO_PRODUCT_ID || 'humm_pro')) problems.push('The Pro product identifier is invalid.');
  return problems;
}
