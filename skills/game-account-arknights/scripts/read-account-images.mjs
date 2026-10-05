#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const option = (name) => args[args.indexOf(name) + 1];
if (!args.includes('--input') || !args.includes('--out')) throw new Error('Usage: read-account-images.mjs --input detail-operation.json --out directory [--limit 4]');
const input = JSON.parse(fs.readFileSync(path.resolve(option('--input')), 'utf8'));
const listing = input.data?.[0] ?? input;
if (!listing.listingId || !listing.url || !Array.isArray(listing.verificationImageUrls)) throw new Error('Expected a detail operation with listing identity and observed verification images');
const output = path.resolve(option('--out'));
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const allowedHosts = new Set(['public-image.pxb7.com', 'pzdsoss.pzds.com']);
const limit = args.includes('--limit') ? Math.min(12, Math.max(1, Number(option('--limit')) || 4)) : 4;
const images = [];
for (const url of listing.verificationImageUrls.slice(0, limit)) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !allowedHosts.has(parsed.hostname)) { images.push({ url, status: 'unsupported_image_host' }); continue; }
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'error' });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`Image response ${response.status}`);
    const chunks = []; let length = 0;
    for await (const chunk of response.body) { length += chunk.length; if (length > 12 * 1024 * 1024) throw new Error('Image exceeds 12 MiB'); chunks.push(chunk); }
    const bytes = Buffer.concat(chunks);
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    const file = path.join(output, `${sha256}.image`);
    fs.writeFileSync(file, bytes, { mode: 0o600 });
    images.push({ url, sha256, local_path: file, status: 'downloaded' });
  } catch (error) { images.push({ url, status: 'failed', error: error.message }); }
}
if (process.platform === 'darwin') {
  const swift = `import Vision
import AppKit
import Foundation
for file in CommandLine.arguments.dropFirst() {
  guard let image = NSImage(contentsOfFile: file), let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.recognitionLanguages = ["zh-Hans", "en-US"]
  try? VNImageRequestHandler(cgImage: cg).perform([request])
  let lines: [[String: Any]] = (request.results ?? []).compactMap { observation in
    guard let text = observation.topCandidates(1).first else { return nil }
    let box = observation.boundingBox
    return ["text": text.string, "confidence": text.confidence, "region": [box.minX, 1-box.maxY, box.width, box.height]]
  }
  let data = try! JSONSerialization.data(withJSONObject: ["file": file, "lines": lines])
  print(String(data: data, encoding: .utf8)!)
}`;
  const paths = images.filter((image) => image.local_path).map((image) => image.local_path);
  if (paths.length) {
    const result = spawnSync('swift', ['-e', swift, ...paths], { encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
    for (const line of (result.stdout ?? '').trim().split('\n').filter(Boolean)) {
      try { const row = JSON.parse(line); const image = images.find((image) => image.local_path === row.file); if (image) image.ocr = row.lines; } catch {}
    }
    if (result.status !== 0) for (const image of images) if (image.local_path) image.ocr_error = String(result.stderr ?? result.error?.message ?? 'OCR unavailable').slice(0, 600);
  }
}
const packet = { listing_id: String(listing.listingId), source_url: listing.url, observed_at: new Date().toISOString(), images,
  reviews: [], next_action: 'Inspect local images and OCR regions. Record exact operator/elite/mastery/module reviews with source URL, image SHA-256 and region. OCR alone does not confirm field ownership.' };
fs.writeFileSync(path.join(output, 'image-evidence.json'), `${JSON.stringify(packet, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ listing_id: packet.listing_id, evidence_path: path.join(output, 'image-evidence.json'), downloaded: images.filter((image) => image.local_path).length, ocr_images: images.filter((image) => image.ocr).length }));
