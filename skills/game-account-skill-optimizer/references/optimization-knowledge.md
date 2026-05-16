# Optimizer Knowledge

updated_at: 2026-05-17

## Known Run Signals

- Repeated platform timeouts should become a future wait-budget or fallback rule.
- Empty result pages with login prompts should become a data-source limitation, not a repeated retry loop.
- Missing mainstream platforms should become a platform coverage finding even if one platform produced a usable result.
- Raw machine-readable tags in a final recommendation should become an output-format finding.
- User feedback about game meta should become evidence for a rule update suggestion, not an immediate high-confidence rule.

## Safe Patch Policy

Autopatch-safe changes:

- Adding platform coverage guidance.
- Adding output-format guidance.
- Adding runtime logging fields.
- Adding deterministic fixtures.

Not autopatch-safe by default:

- Changing game valuation weights.
- Declaring new community meta as high confidence.
- Implementing platform scraping or browser bypass logic.
- Removing risk checks to improve scores.

## Validation Expectations

An optimizer sample should identify at least one issue from a real run artifact. A high-quality report should include target files, evidence, severity, category, and whether the suggestion is safe to autopatch.

