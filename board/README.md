# Public Operator Board

**status_authority:** `NONE`
**Who:** Human Operator (ring-0) — this board is **yours to spam**
**Where:** public on `main` by design

**Provenance:** ported from `Natoshi-moto/Lab` `board/`, which sat empty on Lab's protected `main` since 2026-07-23. This board's own premise — "ok to be ugly," "ideas before experiments," no review required — belongs in Experimental Sandbox, not behind Lab's required-review branch protection. See `board/thoughts/2026-07-23-board-moved-to-sandbox.md`.

This is **not** STATUS. Not a product backlog with liability. Not an investment feed.

It **is** a public firehose for:

- articles (drafts, links, rants)
- tweets / short posts
- thoughts for later
- plans
- rough sketches
- anything you want **on the record** without polishing

---

## How you add something (30 seconds)

### Option A — drop a file

```bash
# from repo root
cp board/TEMPLATE.md board/thoughts/$(date -u +%Y%m%dT%H%M%SZ)_short-slug.md
# edit it, then:
# add one line at TOP of board/INDEX.md
```

### Option B — paste into the firehose

Append to `board/INBOX.md` under **newest first**.
A seat or you can file it into a folder later — or leave it forever. **Mess is allowed.**

### Option C — tell an AI

```text
CALL SCRIBE
Board: tweet — <paste>
```

They write the file + INDEX row. They do **not** need your polish.

---

## Folders

| Path | Use |
|------|-----|
| `INBOX.md` | Raw spam / unsorted |
| `articles/` | Longer pieces |
| `tweets/` | Short public posts / X drafts |
| `thoughts/` | Half-formed ideas |
| `plans/` | Plans (not STATUS next-action) |
| `sketches/` | Rough architecture / ASCII / links |
| `later/` | Explicit parking lot |
| `INDEX.md` | Newest-first ledger of **filed** items |

---

## Relation to the rest of Experimental Sandbox

| This board | Not this board |
|------------|----------------|
| Public human firehose | `CHARTER.md` zones / branch discipline |
| OK to be ugly | Promotion package (`templates/PROMOTION.md`) |
| Ideas before experiments | `sandbox/experiment/*`, `sandbox/break/*` code thrash |
| Linked to sandbox branches when you want | Automatic promotion to Lab |

When a thought becomes real work: open a `sandbox/thought/*`, `sandbox/experiment/*`, `sandbox/fork/*`, or `sandbox/break/*` branch (see `CHARTER.md`), link it from the board item, thrash safely. `main` stays clean except board posts + accepted merges.

If a result survives and you want Lab to consider it, that is a **separate** step through `templates/PROMOTION.md` / `assistant/skills/request-lab-promotion/`. Board posts never promote themselves.

---

## Non-claims

Spamming the board is not a product launch, token, or safety certificate.
`status_authority: NONE`
