#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--skill') options.skill = argv[++i];
    else if (arg === '--evidence') options.evidence = argv[++i];
    else if (arg === '--out') options.out = argv[++i];
    else if (arg === '--write') options.write = true;
  }
  return options;
}

function listItems(items = []) {
  if (!items.length) return '- none';
  return items.map((item) => `- ${item}`).join('\n');
}

function renderEvidence(gameName, evidence) {
  const sourceCoverage = evidence.source_coverage ?? {};
  const sources = evidence.sources ?? [];
  const consensus = evidence.consensus ?? {};
  const limitations = evidence.limitations ?? [];
  const coverageYaml = Object.entries(sourceCoverage)
    .map(([key, value]) => `  ${key}: ${value}`)
    .join('\n');
  const sourceLines = sources.length
    ? sources.map((source) => `- [${source.title}](${source.url})：${source.note ?? 'source evidence'}`).join('\n')
    : '- none';

  return `# ${gameName} 社区证据快照

updated_at: ${evidence.updated_at}

\`\`\`yaml
source_coverage:
${coverageYaml || '  unknown: not_checked'}
community_confidence: ${evidence.community_confidence ?? 'low'}
\`\`\`

## 证据来源

${sourceLines}

## 共识归纳

### 高价值资产

${listItems(consensus.high_value_assets)}

### 中价值资产

${listItems(consensus.medium_value_assets)}

### 低价值或陷阱资产

${listItems(consensus.low_value_or_trap_assets)}

### 风险因素

${listItems(consensus.risk_factors)}

## 局限

${listItems(limitations)}
`;
}

function inferGameName(skillPath) {
  const skillFile = path.join(skillPath, 'SKILL.md');
  if (!fs.existsSync(skillFile)) return path.basename(skillPath).replace(/^game-account-/, '');
  const content = fs.readFileSync(skillFile, 'utf8');
  const description = content.match(/^description:\s*(.+)$/m)?.[1];
  if (description) return description.split('账号')[0].trim();
  return path.basename(skillPath).replace(/^game-account-/, '');
}

const options = parseArgs(process.argv.slice(2));
if (!options.skill || !options.evidence) {
  console.error('Usage: update-community-evidence.mjs --skill <skill-path> --evidence <evidence.json> [--out output-dir]');
  process.exit(2);
}

const skillPath = path.resolve(options.skill);
const evidencePath = path.resolve(options.evidence);
const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
const gameName = inferGameName(skillPath);
const rendered = renderEvidence(gameName, evidence);
const repoWritePath = path.join(skillPath, 'references/community-evidence.md');
const outputPath = options.out
  ? path.join(path.resolve(options.out), 'community-evidence.md')
  : repoWritePath;

if (!options.out && !options.write) {
  console.error('Refusing to overwrite repository evidence without --write. Pass --out for dry-run output or --write to update the skill.');
  process.exit(2);
}
if (!options.out && !fs.existsSync(path.join(skillPath, 'SKILL.md'))) {
  console.error(`Skill path does not look valid: ${skillPath}`);
  process.exit(1);
}
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, rendered);

const report = {
  skill_path: options.skill,
  updated_at: evidence.updated_at,
  confidence: evidence.community_confidence ?? 'low',
  sources_added: (evidence.sources ?? []).length,
  failed_sources: Object.entries(evidence.source_coverage ?? {})
    .filter(([, value]) => String(value).includes('failed') || String(value).includes('timeout'))
    .map(([name, value]) => ({ name, status: value })),
  output_path: outputPath
};

console.log('<community_refresh_report>');
console.log(`  <skill_path>${report.skill_path}</skill_path>`);
console.log(`  <updated_at>${report.updated_at}</updated_at>`);
console.log(`  <confidence>${report.confidence}</confidence>`);
console.log(`  <sources_added>${report.sources_added}</sources_added>`);
console.log(`  <failed_sources format="json">${JSON.stringify(report.failed_sources)}</failed_sources>`);
console.log(`  <output_path>${report.output_path}</output_path>`);
console.log('</community_refresh_report>');
