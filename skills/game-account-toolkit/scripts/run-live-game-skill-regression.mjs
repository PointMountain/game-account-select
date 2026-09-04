#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const args = process.argv.slice(2);
const valueAfter = (flag, fallback = null) => {
  const inline = args.find((arg) => arg.startsWith(`${flag}=`));
  if (inline) return inline.slice(flag.length + 1);
  const index = args.indexOf(flag);
  return index < 0 ? fallback : args[index + 1] ?? fallback;
};
const requestedGames = new Set(String(valueAfter('--games', 'arknights,zenless-zone-zero,wuthering-waves,neverness-to-everness')).split(',').map((value) => value.trim()).filter(Boolean));
const taskPrefix = valueAfter('--task-prefix', `game-skill-live-${Date.now()}`);
const keepArtifacts = args.includes('--keep-artifacts');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'game-skill-live-regression-'));

function run(script, scriptArgs, timeout = 240000) {
  const startedAt = Date.now();
  const result = spawnSync(process.execPath, [path.resolve(repoRoot, script), ...scriptArgs], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout,
    maxBuffer: 1024 * 1024 * 64,
    env: { ...process.env },
  });
  return { ok: result.status === 0, status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', duration_ms: Date.now() - startedAt };
}

function parseJson(text) {
  const value = String(text ?? '').trim();
  try { return JSON.parse(value); } catch {}
  const start = value.search(/[\[{]/);
  const end = Math.max(value.lastIndexOf('}'), value.lastIndexOf(']'));
  if (start >= 0 && end > start) return JSON.parse(value.slice(start, end + 1));
  throw new Error(`command did not emit JSON: ${value.slice(0, 500)}`);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function numberFrom(text, pattern) {
  const match = String(text ?? '').match(pattern);
  if (!match) return 0;
  const value = Number(String(match[1]).replaceAll(',', ''));
  return Number.isFinite(value) ? value : 0;
}

function operation(taskSpace, id, extra = []) {
  const execution = run('skills/game-account-toolkit/scripts/run-ego-operation.mjs', [
    '--operation', id,
    '--task-space', taskSpace,
    '--task-space-disposition', 'keep',
    '--json',
    ...extra,
  ]);
  const report = parseJson(execution.stdout);
  if (!execution.ok || report.ok !== true) throw new Error(`${id} failed: ${(report.reasons ?? []).join(', ') || execution.stderr}`);
  return { ...report, duration_ms: execution.duration_ms };
}

function cleanup(taskSpace) {
  const execution = run('skills/game-account-toolkit/scripts/cleanup-query-session.mjs', ['--task-space', taskSpace, '--json']);
  const report = parseJson(execution.stdout);
  if (!execution.ok || report.ok !== true) throw new Error(`cleanup failed for ${taskSpace}: ${execution.stderr || execution.stdout}`);
  return report;
}

const wuwaAliases = new Map(Object.entries({
  绯雪: 'Hiyuki', 爱弥斯: 'Aemeath', 琳奈: 'Lynae', 莫宁: 'Mornye', 卡提希娅: 'Cartethyia', 守岸人: 'Shorekeeper',
  弗洛洛: 'Phrolova', 今汐: 'Jinhsi', 赞妮: 'Zani', 菲比: 'Phoebe', 坎特蕾拉: 'Cantarella', 凌阳: 'Lingyang',
  卡卡罗: 'Calcharo', 安可: 'Encore', 长离: 'Changli', 吟霖: 'Yinlin', 珂莱塔: 'Carlotta', 千咲: 'Chisa', 夏空: 'Xia Kong',
}));

function mapZzz(detail) {
  const agents = Object.entries(detail.agentStatuses ?? {}).map(([name, status]) => ({
    name, category: 'unknown', mindscape: numberFrom(status, /(\d+)/), role: 'unknown',
  }));
  return {
    id: detail.listingId, platform: 'pzds', url: detail.url, price: detail.priceCny, title: detail.title,
    server: /官服/.test(detail.binding?.server ?? '') ? '官服' : detail.binding?.server ?? null,
    listed_at_raw: detail.listedAt ?? null,
    raw_text: [detail.title, detail.voidHunters, detail.sellerNote].filter(Boolean).join('；'),
    agentStatuses: detail.agentStatuses,
    game_assets: {
      agents,
      agent_statuses: detail.agentStatuses,
      s_w_engine_names: detail.sWEngineNames ?? [],
      w_engines: (detail.sWEngineNames ?? []).map((name) => ({ name, signature_for: null })),
      resources: {
        polychrome: detail.resources?.polychrome ?? 0,
        film_tape: detail.resources?.filmTape ?? 0,
        encrypted_master_tape: detail.resources?.encryptedMasterTape ?? 0,
      },
      progression: { inter_knot_level: detail.resources?.level ?? null },
      risk: {
        email_status: /未绑定/.test(detail.binding?.email ?? '') ? 'unbound' : 'unknown',
        hoyoverse_binding: /提供换绑码/.test(detail.binding?.changeCode ?? '') ? 'changeable' : 'unknown',
        psn_binding: /未绑定/.test(detail.binding?.psn ?? '') ? 'clean' : 'unknown',
        tap_binding: /未绑定/.test(detail.binding?.tap ?? '') ? 'clean' : 'unknown',
        guarantee: detail.status?.guarantee ? 'retrieval_compensation' : 'unknown',
        official_verification: detail.status?.officialVerification === true,
      },
    },
  };
}

function mapWuwa(detail) {
  const characters = (detail.assets ?? []).filter((asset) => /^MC000/i.test(asset.code)).map((asset) => {
    const name = wuwaAliases.get(asset.name) ?? asset.name;
    return { name, resonance_chain: numberFrom(asset.cornerMark, /(\d+)/), category: ['Lingyang', 'Calcharo', 'Encore', 'Jianxin'].includes(name) ? 'standard' : 'limited' };
  });
  const weapons = (detail.assets ?? []).filter((asset) => /^MC10/i.test(asset.code)).map((asset) => ({ name: asset.name, signature_for: null }));
  const text = detail.rawText ?? '';
  const cleanBinding = /未绑定TAP/.test(text) && /未绑定Wegame/i.test(text);
  return {
    id: detail.listingId, platform: 'pzds', game: 'Wuthering Waves', url: detail.url, price: detail.priceCny,
    title: detail.title, server: detail.server, raw_text: text,
    game_assets: {
      characters,
      weapons_or_equipment: weapons,
      premium_currency: {
        astrite: numberFrom(text, /【星声】(\d+)/), radiant_tide: numberFrom(text, /【浮金波纹】(\d+)/),
        forging_tide: numberFrom(text, /【铸潮波纹】(\d+)/), afterglow_coral: numberFrom(text, /【余波珊瑚】(\d+)/),
        lunites: numberFrom(text, /【月相】(\d+)/),
      },
      game_specific: {
        binding: cleanBinding ? 'clean' : 'unknown',
        guarantee: detail.status?.guarantee ? 'retrieval_compensation' : 'unknown',
        official_verification: detail.status?.officialVerification === true,
      },
    },
  };
}

function mapNeverness(detail) {
  const text = detail.rawText ?? '';
  const characters = (detail.assets ?? []).filter((asset) => /^YH000/i.test(asset.code)).map((asset) => ({ name: asset.name, awakening: numberFrom(asset.cornerMark, /(\d+)/) }));
  const arcs = (detail.assets ?? []).filter((asset) => /^YH20/i.test(asset.code)).map((asset) => ({ name: asset.name, fits: null }));
  return {
    id: detail.listingId, platform: 'pzds', game: 'Neverness to Everness', url: detail.url, price: detail.priceCny,
    title: detail.title, server: detail.server, raw_text: text,
    game_assets: {
      s_characters: characters,
      s_character_count_claim: characters.length,
      s_arc_plates: arcs,
      resources: {
        ring_stones: numberFrom(text, /【环石】(\d+)/), crystals: numberFrom(text, /异晶(\d+)/),
        solid_dice: numberFrom(text, /【质实骰子数量】(\d+)/), triple_keys: numberFrom(text, /【三重钥匙】(\d+)/),
      },
      progression: { hunter_level: numberFrom(text, /【猎人等级】(\d+)/) || null },
      account: {
        account_type: 'official', tap_binding: /未绑定TAP/.test(text) ? 'clean' : 'unknown',
        guarantee: detail.status?.guarantee ? 'retrieval_compensation' : 'unknown',
        official_verification: detail.status?.officialVerification === true,
      },
    },
  };
}

const gameConfigs = {
  'zenless-zone-zero': {
    label: '绝区零', list: 'pzds/zzz-list', detail: 'pzds/zzz-detail', evaluator: 'skills/game-account-zenless-zone-zero/scripts/evaluate-listing.mjs',
    finalizer: 'skills/game-account-zenless-zone-zero/scripts/finalize-evaluation-run.mjs', fixture: 'skills/game-account-zenless-zone-zero/test-fixtures/zenless-zone-zero-run-artifact.json', map: mapZzz,
  },
  'wuthering-waves': {
    label: '鸣潮', list: 'pzds/wuthering-waves-list', detail: 'pzds/wuthering-waves-detail', evaluator: 'skills/game-account-wuthering-waves/scripts/evaluate-listing.mjs',
    finalizer: 'skills/game-account-wuthering-waves/scripts/finalize-evaluation-run.mjs', fixture: 'skills/game-account-wuthering-waves/test-fixtures/wuthering-waves-run-artifact.json', map: mapWuwa,
  },
  'neverness-to-everness': {
    label: '异环', list: 'pzds/neverness-to-everness-list', detail: 'pzds/neverness-to-everness-detail', evaluator: 'skills/game-account-neverness-to-everness/scripts/evaluate-listing.mjs',
    finalizer: 'skills/game-account-neverness-to-everness/scripts/finalize-evaluation-run.mjs', fixture: 'skills/game-account-neverness-to-everness/test-fixtures/neverness-run-artifact.json', map: mapNeverness,
  },
};

function runGenericGame(game, config) {
  const taskSpace = `${taskPrefix}-${game}`;
  let cleanupReport = null;
  try {
    const listReport = operation(taskSpace, config.list, ['--limit', '3']);
    const candidate = listReport.data?.[0];
    if (!candidate?.listingId) throw new Error(`${game} live list returned no candidate`);
    const detailReport = operation(taskSpace, config.detail, ['--input', candidate.listingId]);
    const detail = detailReport.data?.[0];
    if (!detail?.listingId) throw new Error(`${game} live detail returned no candidate`);
    const input = config.map(detail);
    const inputPath = path.join(temporaryRoot, `${game}.input.json`);
    const evaluationPath = path.join(temporaryRoot, `${game}.evaluation.json`);
    fs.writeFileSync(inputPath, `${JSON.stringify(input, null, 2)}\n`);
    const evaluator = run(config.evaluator, ['--input', inputPath, '--out', evaluationPath]);
    if (!evaluator.ok) throw new Error(`${game} evaluator failed: ${evaluator.stderr || evaluator.stdout}`);
    const evaluation = JSON.parse(fs.readFileSync(evaluationPath, 'utf8'));
    cleanupReport = cleanup(taskSpace);

    const artifact = JSON.parse(fs.readFileSync(path.join(repoRoot, config.fixture), 'utf8'));
    const request = `实时回归${config.label}游戏 skill，使用 PZDS 找到账号并完成估值`;
    artifact.run_id = `${game}-live-regression-${Date.now()}`;
    artifact.user_request = request;
    artifact.request_provenance = {
      raw_user_request: request, raw_user_request_sha256: sha256(request), profile_input: request, profile_input_sha256: sha256(request),
    };
    artifact.selection_profile.source_text = request;
    artifact.selection_profile.platforms = ['pzds'];
    artifact.success_criteria.minimum_source_coverage.platforms = ['pzds'];
    artifact.coverage_plan.source_tasks = [{ id: 'pzds-live', type: 'platform_query', source: 'pzds', priority: 'required', success_signal: 'verified list and detail operations' }];
    artifact.platform_attempts = [{
      platform: 'pzds', status: 'success', result_count: listReport.data.length,
      duration_ms: listReport.duration_ms + detailReport.duration_ms, wait_budget_ms: 180000, browser_used: true,
      query_governance: 'ego_ops', browser_transport: 'ego_browser', operation: config.detail,
      operation_verified: true, knowledge_status: detailReport.ego_ops.knowledge_status,
      operation_reference: detailReport.ego_ops.operation_reference,
      ego_task_space_id: detailReport.task_space_id, ego_task_space_name: detailReport.task_space_name,
      operations: [config.list, config.detail],
      list_attempts: [{ operation: config.list, mode: 'list', status: 'success', operation_verified: true, knowledge_status: listReport.ego_ops.knowledge_status, operation_reference: listReport.ego_ops.operation_reference, knowledge_sha256: listReport.ego_ops.knowledge_sha256 }],
      detail_attempts: [{ operation: config.detail, mode: 'detail', status: 'success', operation_verified: true, knowledge_status: detailReport.ego_ops.knowledge_status, operation_reference: detailReport.ego_ops.operation_reference, knowledge_sha256: detailReport.ego_ops.knowledge_sha256 }],
    }];
    artifact.coverage_gaps = [];
    artifact.cleanup_reports = [cleanupReport];
    artifact.knowledge_update_candidates = [{ id: `${game}-pzds-verified`, apply_status: 'verified_existing', evidence: `${config.list}, ${config.detail}` }];
    artifact.evaluations = [evaluation];
    const artifactPath = path.join(temporaryRoot, `${game}.run.json`);
    fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
    const finalizer = run(config.finalizer, ['--input', artifactPath], 300000);
    const finalized = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    if (!finalizer.ok || finalized.quality_gate?.redo_required !== false) throw new Error(`${game} finalizer failed: ${finalizer.stderr || finalizer.stdout}`);
    return {
      game, skill: artifact.target_skill, listing_id: input.id, price_cny: input.price, url: input.url,
      list_operation: config.list, detail_operation: config.detail, evaluator: config.evaluator,
      finalizer: config.finalizer, final_score: Object.values(evaluation).find((value) => value?.final_score)?.final_score ?? null,
      confidence: Object.values(evaluation).find((value) => value?.confidence)?.confidence ?? null,
      quality_gate: 'passed', cleanup: 'passed',
    };
  } finally {
    if (!cleanupReport) {
      try { cleanup(taskSpace); } catch {}
    }
  }
}

function runArknights() {
  const taskSpace = `${taskPrefix}-arknights`;
  const artifactPath = path.join(temporaryRoot, 'arknights.run.json');
  const reportPath = path.join(temporaryRoot, 'arknights.md');
  const execution = run('skills/game-account-arknights/scripts/run-pxb7-selection.mjs', [
    '--request', '明日方舟2000元左右，队伍成熟、限定和抽卡资源优先，用于实时回归',
    '--out', artifactPath, '--report-out', reportPath, '--task-space', taskSpace,
    '--limit', '3', '--batches', '1', '--details-per-platform', '1', '--display-per-platform', '1', '--recommendations', '2', '--backups', '1',
  ], 600000);
  if (!fs.existsSync(artifactPath)) throw new Error(`arknights runner did not emit artifact: ${execution.stderr || execution.stdout}`);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  if (!execution.ok || artifact.quality_gate?.redo_required !== false) throw new Error(`arknights full stack failed: ${execution.stderr || execution.stdout}`);
  const listing = artifact.recommendations?.[0] ?? Object.values(artifact.platform_shortlists ?? {}).flatMap((value) => value?.qualified ?? value?.recommendations ?? [])[0];
  return {
    game: 'arknights', skill: 'skills/game-account-arknights', listing_id: listing?.listing_id ?? listing?.id ?? null,
    price_cny: listing?.price ?? null, url: listing?.url ?? null,
    list_operation: 'pxb7/arknights-list + pzds/arknights-list', detail_operation: 'pxb7/arknights-detail + pzds/arknights-detail',
    evaluator: 'skills/game-account-arknights/scripts/score-listings.mjs', finalizer: 'skills/game-account-arknights/scripts/finalize-selection-run.mjs',
    final_score: listing?.final_score ?? null, confidence: listing?.confidence ?? null, quality_gate: 'passed', cleanup: 'passed',
  };
}

const results = [];
const failures = [];
try {
  if (requestedGames.has('arknights')) {
    try { results.push(runArknights()); } catch (error) { failures.push({ game: 'arknights', error: error.message }); }
  }
  for (const [game, config] of Object.entries(gameConfigs)) {
    if (!requestedGames.has(game)) continue;
    try { results.push(runGenericGame(game, config)); } catch (error) { failures.push({ game, error: error.message }); }
  }
  const report = {
    ok: failures.length === 0 && results.length === requestedGames.size,
    query_governance: 'ego_ops', browser_transport: 'ego_browser', requested_games: [...requestedGames], results, failures,
    artifacts: keepArtifacts ? temporaryRoot : 'removed_after_validation',
  };
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.ok ? 0 : 1;
} finally {
  if (!keepArtifacts) fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
