## Agent skills

### Issue tracker

Issues for this repo live as GitHub Issues in `olillevik/todo`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.
<!-- my-plugin:issue-workflow start -->
- **Spec from an existing ticket**: add the spec to that ticket's body under a `## Spec` heading, replacing any existing `## Spec` section. Apply the label for the `ready-for-agent` role (see `docs/agents/triage-labels.md`).
- **Spec with no existing ticket**: create a new ticket for the spec.
- **Implementation tickets** (for example from `to-tickets`): create each one as a sub-issue of the ticket it was based on, the existing ticket or the spec ticket. With no such ticket, create standalone tickets.
- **Sub-issue operation**: see `docs/agents/issue-tracker.md`. If the tracker has none, link parent and child both ways: the child refers to its parent, and the parent's body gets a `## Child tickets` checklist with one line per child. This overrides to-tickets' rule against modifying the parent, for these links only. Do not change the parent's open or closed state.
<!-- my-plugin:issue-workflow end -->

### Triage labels

Five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Session log

Each working session in this repo gets one file in `sessions/`. The folder is the source for later presentations, so keep entries factual.

- **File name:** `sessions/YYYY-MM-DD-<short-slug>.md`. Choose a slug that no existing file uses.
- **When to write:** create the file when the session's main work is done, before the session ends. If more work follows in the same session, update that session's file. Never edit a file from an earlier session.
- **Content:** use this structure. Keep it to these two fields.

```markdown
# Session <YYYY-MM-DD>: <short title>

**Asked:** what the user wanted, in one or two sentences.

**Result:** what came out of it, in one to three sentences, with links to anything created.
```

- **Rules:** describe the session at a high level: what was asked and what the output was. No step lists, command output, verification details, or file-by-file inventories. Never record secrets, tokens, or personal data.
- **Git:** `sessions/` is listed in `.gitignore`. Do not commit or unignore it unless the user asks.

## Commits

- Do not add a `Co-Authored-By` trailer or other attribution line to commit messages. The user does not want them in this repo.
