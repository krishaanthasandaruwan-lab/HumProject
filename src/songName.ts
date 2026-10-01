// New songs are called "Song 1", "Song 2", … — the next number after the highest one already saved.
import { listProjects } from './storage';

export async function nextSongName(): Promise<string> {
  const names = (await listProjects().catch(() => [])).map((m) => m.name);
  const used = new Set(names);
  let n = names.length + 1;
  for (const name of names) {
    const m = /^Song (\d+)$/.exec(name);
    if (m) n = Math.max(n, Number(m[1]) + 1);
  }
  while (used.has(`Song ${n}`)) n++;
  return `Song ${n}`;
}
