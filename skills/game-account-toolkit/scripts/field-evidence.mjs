const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const methods = new Set(['platform_detail', 'platform_asset_grid', 'image_review', 'ocr_confirmed']);

export function validImageProof(listing, item) {
  const region = item.region;
  return (listing.game_assets?.platform_facts?.verification_image_urls ?? []).includes(item.image_url)
    && /^[a-f0-9]{64}$/.test(item.image_sha256 ?? '') && Array.isArray(region) && region.length === 4
    && region.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)
    && region[2] > 0 && region[3] > 0 && region[0] + region[2] <= 1 && region[1] + region[3] <= 1;
}

export function fieldEvidenceStatus(listing, field, value, now = new Date().toISOString()) {
  const id = listing.listing_id ?? listing.id;
  const rows = (Array.isArray(listing.field_evidence) ? listing.field_evidence : []).filter((item) => item?.field === field);
  const supported = rows.filter((item) => id != null && String(id).trim() && /^https?:\/\//.test(listing.url ?? '')
    && methods.has(item.method) && String(item.listing_id) === String(id)
    && (!['image_review', 'ocr_confirmed'].includes(item.method) || validImageProof(listing, item))
    && item.source_url === listing.url && item.observed_at && Number.isFinite(Date.parse(item.observed_at))
    && Date.parse(item.observed_at) <= Date.parse(now) && Date.parse(now) - Date.parse(item.observed_at) < 86400000
    && ((typeof item.quote === 'string' && item.quote.trim()) || (item.source_field && Object.hasOwn(item, 'source_value')) || (item.image_url && item.region)));
  if (supported.some((item) => !same(item.value, value))) return { field, status: 'conflicting', evidence: supported };
  if (value == null || !supported.some((item) => same(item.value, value))) return { field, status: 'unverified', evidence: rows };
  return { field, status: 'verified', evidence: supported };
}
