import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const skillDirectories = ['.agents/skills', '.codex/skills', '.claude/skills'];

export function findSkill(skillName, {
  cwd = process.cwd(), home = os.homedir(), skillRoot = null, codexHome = process.env.CODEX_HOME,
  extraRoots = (process.env.GAME_ACCOUNT_EXTRA_SKILL_DIRS ?? '').split(path.delimiter).filter(Boolean),
} = {}) {
  const roots = [];
  let directory = path.resolve(cwd);
  while (true) {
    if (!home || directory !== path.resolve(home)) roots.push(...skillDirectories.map((item) => path.join(directory, item)));
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  if (skillRoot) roots.push(path.dirname(skillRoot));
  roots.push(...extraRoots);
  if (codexHome) roots.push(path.join(codexHome, 'skills'));
  if (home) roots.push(...skillDirectories.map((item) => path.join(home, item)));
  for (const root of new Set(roots)) {
    const candidate = path.join(root, skillName, 'SKILL.md');
    try {
      fs.accessSync(candidate, fs.constants.R_OK);
      if (fs.statSync(candidate).isFile()) return { ok: true, found: candidate };
    } catch { /* Try the next supported location. */ }
  }
  return { ok: false, found: null };
}

export function findExecutable(command, { pathValue = process.env.PATH ?? '', platform = process.platform,
  pathExt = process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD' } = {}) {
  const extensions = platform === 'win32' ? ['', ...pathExt.split(';').filter(Boolean)] : [''];
  for (const directory of pathValue.split(path.delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      const candidate = path.resolve(directory, `${command}${extension}`);
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        if (fs.statSync(candidate).isFile()) return { ok: true, found: candidate };
      } catch { /* Try the next PATH entry. */ }
    }
  }
  return { ok: false, found: null };
}
