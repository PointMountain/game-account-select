export function cleanText(value) {
  return String(value ?? '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

export function cleanWEngineName(value) {
  return cleanText(value)
    .replace(/^(?:精\s*\d+|精炼\s*\d+|精煉\s*\d+|Lv\.?\s*\d+)\s*/i, '')
    .replace(/^(?:S级音擎|S級音擎|S级武器|S級武器|音擎)\s*[：:]?\s*/i, '')
    .replace(/[。；;，,、]+$/g, '')
    .trim();
}

export function normalizeAgentName(value) {
  const name = cleanText(value).replace(/^满命/, '');
  return name === '雅' ? '星见雅' : name;
}

export function parseTitleAgent(value) {
  const item = cleanText(value);
  if (!item) return null;
  const fullMindscape = item.match(/^满命(.+)$/);
  const numberedMindscape = item.match(/^(\d+)命(.+)$/);
  const name = normalizeAgentName(fullMindscape?.[1] ?? numberedMindscape?.[2] ?? item);
  if (!name) return null;
  const dupes = fullMindscape ? 6 : numberedMindscape ? Number(numberedMindscape[1]) : 0;
  return { name, dupes, raw: item };
}

export function parseWEngineNamesFromText(text) {
  const blocks = [];
  const raw = String(text ?? '');
  for (const match of raw.matchAll(/(?:(\d+)\s*个)?S级(?:音擎|武器)[：:]\s*([^；;\n]+)/g)) {
    const names = [];
    for (const part of String(match[2] ?? '').split(/[，,、；;|/]/)) {
      const name = cleanWEngineName(part);
      if (name) names.push(name);
    }
    if (names.length) blocks.push({ hasCount: match[1] != null, names });
  }
  const countedBlock = blocks.find((block) => block.hasCount);
  return countedBlock ? countedBlock.names : blocks.flatMap((block) => block.names);
}

export function parseTitleSnapshot(text) {
  const title = cleanText(text);
  const agentBlock = title.match(/(?:\d+个S级代理人|S级代理人)[：:]([^；\n]+)/)?.[1] ?? '';
  const agentStatuses = {};
  for (const part of agentBlock.split(/[，,、]/)) {
    const agent = parseTitleAgent(part);
    if (agent && agentStatuses[agent.name] == null) agentStatuses[agent.name] = String(agent.dupes);
  }
  return {
    listingId: title.match(/【([^】]+)】/)?.[1] ?? '',
    agentStatuses,
    sWEngineNames: parseWEngineNamesFromText(title),
  };
}
