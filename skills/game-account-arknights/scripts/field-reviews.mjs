import { validImageProof } from './recommendation-evidence.mjs';

export function mergeFieldReviews(listing, reviews) {
  const result = structuredClone(listing);
  result.field_evidence ??= [];
  for (const review of reviews ?? []) {
    if (String(review.listing_id) !== String(listing.listing_id) || review.source_url !== listing.url) continue;
    if (!['image_review', 'ocr_confirmed'].includes(review.method) || !validImageProof(result, review)
      || !review.quote?.trim()) throw new Error(`Invalid image review for ${listing.listing_id}`);
    const match = String(review.field).match(/^operators\.(.+)\.(present|elite|mastery|module)$/);
    if (!match) throw new Error(`Unsupported reviewed field: ${review.field}`);
    const [, name, field] = match;
    if (field === 'present' ? review.value !== true : !Number.isInteger(review.value) || review.value < 0 || review.value > (field === 'elite' ? 2 : 3)) throw new Error('Invalid reviewed field value');
    result.game_assets ??= {};
    result.game_assets.operators ??= [];
    let operator = result.game_assets.operators.find((item) => item.name === name);
    if (!operator && field === 'present') { operator = { name, elite: null, mastery: null, module: null }; result.game_assets.operators.push(operator); }
    if (!operator) throw new Error(`Confirm operator presence before reviewing progression: ${name}`);
    // Contradictions retain both observations and are rejected by the recommendation gate.
    if (field !== 'present' && operator[field] == null) operator[field] = review.value;
    result.field_evidence.push({ ...review });
  }
  return result;
}
