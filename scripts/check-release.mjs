import { loadEnv } from 'vite';
import { releaseProblems } from './release-config.ts';
const env = { ...loadEnv('release', process.cwd(), ''), ...process.env };
const problems = releaseProblems(env);
if (problems.length) {
  console.error('Release configuration is incomplete:\n' + problems.map((p) => '- ' + p).join('\n'));
  process.exitCode = 1;
} else console.log('Release configuration passes. Verify store products, signing, public policy availability and device QA before upload.');
