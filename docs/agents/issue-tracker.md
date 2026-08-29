# Issue tracker: GitHub

Issues and specs for this repository live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- Create an issue with `gh issue create --title "..." --body "..."`.
- Read an issue with `gh issue view <number> --comments`, including labels.
- List issues with `gh issue list --state open --json number,title,body,labels,comments` and the appropriate label or state filters.
- Comment with `gh issue comment <number> --body "..."`.
- Apply or remove labels with `gh issue edit <number> --add-label "..."` or `--remove-label "..."`.
- Close with `gh issue close <number> --comment "..."`.

Infer the repository from `git remote -v`; `gh` does this automatically inside the clone.

## Pull requests as a triage surface

**PRs as a request surface: no.** Pull requests implement tracked work; they are not treated as incoming feature requests.

GitHub shares one number space across issues and pull requests. Resolve an ambiguous `#42` with `gh pr view 42` and fall back to `gh issue view 42`.

## Skill routing

- When a skill says to publish to the issue tracker, create a GitHub issue.
- When a skill says to fetch a relevant ticket, run `gh issue view <number> --comments`.
- Represent blockers with GitHub native issue dependencies when available. Otherwise add a `Blocked by: #<n>` line to the dependent issue.
