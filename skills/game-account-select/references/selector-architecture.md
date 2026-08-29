# Selector architecture

`game-account-select` is the strategy layer for the account-selection system. It should behave like a browser/research operator with a clear buying goal, not like a one-shot search prompt.

## Design philosophy

Use an evidence-first execution model with ego-browser as the single browser transport:

1. Parse and freeze intent before acting. Natural-language budget, objective, priorities, hard conditions, platform and risk preferences become a confirmed run-only `selection_profile`; they never become durable defaults.
2. Define success before acting. A run is complete only when it can explain the best available candidates, what was not covered, and why the remaining uncertainty does not change the recommendation tier.
3. Choose the strongest starting path. User-provided links and verified adapters beat ad hoc browser scraping; platform lists beat broad web search for live listings; community evidence beats platform titles for meta and team value.
4. Treat every step as evidence. Empty pages, timeouts, wrong-game routes, missing subtitles, and partial adapter output are data points that must be preserved in the artifact.
5. Change path instead of repeating failure. After one failed path and one independent check, downgrade or switch source. Do not spend the run retrying the same blocked route.
6. End by sedimenting knowledge. Durable facts become platform notes, evidence snapshots, valuation-rule suggestions, fixtures, or optimizer knowledge. Run budget, weights, server/risk preferences and hard conditions never sediment.

## Layer boundaries

| Layer | Owns | Does not own |
| --- | --- | --- |
| `game-account-select` | Natural-language profile parsing/freezing, user goal, success criteria, source coverage plan, candidate collection order, ranking presentation, run artifact, post-run gates | Game-specific base-dimension facts, platform bypass logic, session preferences as permanent rules |
| `game-account-toolkit` | Shared safety policy, platform access policy, schemas, dependency and adapter support, query cleanup | Final recommendations, game meta ranking |
| Game skill | Asset scoring, risk scoring, game-specific knowledge, validation fixtures | Platform discovery, browser sessions, cross-game policy |
| `game-account-community-updater` | Evidence snapshots, source coverage, limitations | Direct valuation weight changes unless a confirmed rule-update workflow applies them |
| `game-account-skill-optimizer` | Troubleshooting, finding classification, target-file suggestions | Silent business-rule rewrites |
| `game-account-skill-evaluator` | Quality gate and redo signal | Deciding that an unsafe or low-confidence recommendation is acceptable |

## Success criteria

Every run should materialize these fields before querying:

```yaml
success_criteria:
  game: string
  budget:
    primary_max: number | null
    flex_max: number | null
  hard_conditions: string[]
  soft_preferences: string[]
  minimum_source_coverage:
    platforms: string[]
    community_sources: string[]
  completion_conditions:
    - at least one primary-budget qualifying listing or a stated reason none was found
    - required default platforms attempted, read successfully, or explicitly downgraded with evidence
    - community confidence capped according to source coverage
    - every recommended, backup, and excluded listing has a URL or traceable source identifier
    - optimizer and evaluator gates have run on the raw artifact
```

The artifact must also retain `selection_profile.persistence_scope: run_only`, a confirmation digest, and `profile_isolation.durable_updates_from_profile: []`.

The selector may finish with incomplete coverage only when the artifact explains the limitation and the final answer lowers confidence accordingly.

## Completion decision

Stop collecting more data when one of these is true:

- The success criteria are met and more access would only add duplicate listings.
- A platform is blocked by login, verification, wrong-game routing, WAF, or repeated timeout after the allowed fallback.
- Community evidence has enough independent sources for the requested ranking, or the remaining gaps force `community_confidence` to `low` or `medium`.
- The user explicitly provided the only listings they want analyzed.

Continue or loop back when:

- Required default platforms are missing without downgrade evidence.
- Hard conditions are not checked at detail level.
- The top recommendation relies on stale or title-only community evidence.
- Optimizer or evaluator reports actionable non-info findings that can be fixed in the current run.
