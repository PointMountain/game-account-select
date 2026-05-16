# Optimizer Knowledge

updated_at: 2026-05-17

## Known Run Signals

- Repeated platform timeouts should become a future wait-budget or fallback rule.
- Empty result pages with login prompts should become a data-source limitation, not a repeated retry loop.
- Missing mainstream platforms should become a platform coverage finding even if one platform produced a usable result.
- Raw machine-readable tags in a final recommendation should become an output-format finding.
- User feedback about game meta should become evidence for a rule update suggestion, not an immediate high-confidence rule.
- Failed evaluator reports should become `quality_gate` findings, not warnings that can be ignored.
- Tool failures and dependency gaps should go through Troubleshooting before any valuation rule change.

## Harness Philosophy

The repository should behave like a self-evolving harness:

- Every real run leaves an artifact with input, attempts, output, failures and feedback.
- The optimizer turns artifacts into precise findings and target files.
- The evaluator decides whether generated or optimized skill output is usable.
- Low score, blocking issues or `redo_required: true` means the work loops back into diagnosis and patching.
- The loop improves local rules and fixtures without silently rewriting business logic.

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
- Marking a failed evaluator report as acceptable.

## Validation Expectations

An optimizer sample should identify at least one issue from a real run artifact. A high-quality report should include target files, evidence, severity, category, whether the suggestion is safe to autopatch, and which evaluator gate must pass after the change.

Regression coverage should include:

- A real-ish noisy account screening run.
- A clean run with no findings.
- A non-Wuthering target skill run to prove repository-wide routing.
- A failed evaluator run to prove redo behavior.
