# Board item — Board moved from Lab to Sandbox

**ID:** `BOARD-2026-07-23-board-moved-to-sandbox`
**UTC:** 2026-07-23
**Kind:** `thought`
**status_authority:** `NONE`
**Linked branches / PRs:** `add-operator-board` (this branch)

---

## Content

Lab's `board/` sat empty on Lab `main` since it was opened — never used. Its own README already said the quiet part: "public on `main` by design," "OK to be ugly," "ideas before experiments," no review gate. That's Experimental Sandbox's actual charter, word for word — Lab's `main` requires 1 approving review, dismisses stale reviews, requires last-push approval, enforces admins, and requires a passing status check before anything lands. A firehose meant to be spammed unpolished doesn't belong behind that gate; it just sits unused, which is exactly what happened.

So: moved here. A short pointer was left in Lab's `board/` (proposed via PR, not merged directly — Lab's branch protection means only the operator can actually land it).

## Links

- Was: `Natoshi-moto/Lab` `board/README.md`, `board/INDEX.md`, `board/INBOX.md`, `board/TEMPLATE.md`
- Now: this repo, same structure, adapted "relation to the rest of" section to point at Sandbox's `CHARTER.md` zones and `templates/PROMOTION.md` instead of Lab's `lab/`/`play/` branch names, which don't exist here.

## For later / next

- If board volume ever justifies it, revisit whether `INBOX.md` needs its own lightweight CI check (currently only the repo-wide `verify.sh` secret-pattern grep touches it).
