#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);

function readArg(name) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] ?? null;
}

function compact(value) {
  return String(value ?? '').normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '');
}

export function matchesExpected(ocrText, expectedName) {
  const text = compact(ocrText);
  const name = compact(expectedName);
  if (!name) return false;
  if (text.includes(name)) return true;
  const prefixLength = Math.max(4, [...name].length - 1);
  const prefix = [...name].slice(0, prefixLength).join('');
  return prefix.length >= 4 && text.includes(prefix);
}

async function download(url, target) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()));
}

export async function verifyCollabImages({ imageUrls, expectedNames }) {
  const rosterUrls = (Array.isArray(imageUrls) ? imageUrls : []).filter((url) => /\/3_\d+_modify\.(?:png|jpe?g)/i.test(String(url)));
  const names = [...new Set((Array.isArray(expectedNames) ? expectedNames : []).map(String).filter(Boolean))];
  if (!rosterUrls.length || !names.length) return { supported: true, status: 'not_applicable', matched_names: [], missing_names: names, evidence: [] };
  if (process.platform !== 'darwin') return { supported: false, status: 'unsupported_platform', matched_names: [], missing_names: names, evidence: [] };

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arknights-collab-ocr-'));
  try {
    const imagePaths = [];
    const downloadErrors = [];
    for (let index = 0; index < rosterUrls.length; index += 1) {
      const target = path.join(tempDir, `${index + 1}.png`);
      try {
        await download(rosterUrls[index], target);
        imagePaths.push(target);
      } catch (error) {
        downloadErrors.push(error instanceof Error ? error.message : String(error));
      }
    }
    if (!imagePaths.length) return { supported: true, status: 'download_failed', matched_names: [], missing_names: names, evidence: [], errors: downloadErrors };

    const swiftSource = `
import Vision
import AppKit
for imagePath in CommandLine.arguments.dropFirst() {
  print("@@IMAGE:" + imagePath)
  guard let image = NSImage(contentsOfFile: imagePath), let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.recognitionLanguages = ["zh-Hans", "en-US"]
  request.usesLanguageCorrection = true
  try? VNImageRequestHandler(cgImage: cg).perform([request])
  for observation in request.results ?? [] {
    if let candidate = observation.topCandidates(1).first { print(candidate.string) }
  }
}`;
    const result = spawnSync('swift', ['-e', swiftSource, ...imagePaths], { encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024 * 8 });
    if (result.status !== 0) return { supported: true, status: 'ocr_failed', matched_names: [], missing_names: names, evidence: [], errors: [String(result.stderr || result.stdout || 'swift Vision OCR failed').trim()] };

    const blocks = String(result.stdout ?? '').split('@@IMAGE:').slice(1);
    const evidence = blocks.map((block) => {
      const [localPath, ...textLines] = block.trim().split('\n');
      const imageIndex = imagePaths.indexOf(localPath);
      return { url: imageIndex >= 0 ? rosterUrls[imageIndex] : null, ocr_text: textLines.join('\n') };
    });
    const matchedNames = names.filter((name) => evidence.some((item) => matchesExpected(item.ocr_text, name)));
    return {
      supported: true,
      status: matchedNames.length === names.length ? 'verified' : matchedNames.length ? 'partial' : 'not_found',
      matched_names: matchedNames,
      missing_names: names.filter((name) => !matchedNames.includes(name)),
      evidence: evidence.filter((item) => matchedNames.some((name) => matchesExpected(item.ocr_text, name))).map((item) => ({
        url: item.url,
        matched_names: matchedNames.filter((name) => matchesExpected(item.ocr_text, name)),
      })),
      errors: downloadErrors,
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const urls = JSON.parse(readArg('--urls-json') ?? '[]');
  const expected = JSON.parse(readArg('--expected-json') ?? '[]');
  console.log(JSON.stringify(await verifyCollabImages({ imageUrls: urls, expectedNames: expected }), null, 2));
}
