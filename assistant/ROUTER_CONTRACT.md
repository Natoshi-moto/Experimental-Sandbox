# Natural-language router contract

The router classifies meaning, not exact commands.

## Operator-hold preflight

Read [`EMERGENCY_CURRENT_STATUS.md`](../EMERGENCY_CURRENT_STATUS.md) before
routing. An active dated written operator hold outranks activation phrases,
route defaults, old branches, open pull requests, model output, passing checks,
and implied momentum within its scope.

`SBX-SOH-001` currently limits internal-credit, agent-economy,
community-allocation, and AI-work mechanisms to the research classes listed in
its [canonical order](../operations/operator-holds/SBX-SOH-001/ORDER.md).
Unrelated Sandbox work is not frozen.

## Asymmetric ambiguity

When intent is vague:

- choose the most useful reversible action inside Sandbox that is permitted by every active operator hold
- preserve the raw input
- do not interrupt flow for Git choices
- stop at external publication if secrets, personal data, rights or material harm are unclear
- stop at the Lab boundary regardless of enthusiasm or wording

This asymmetry is deliberate: ambiguity grants creative latitude, not canonical authority.

## Intent classes

| Intent | Loose examples | Maximum authority |
|---|---|---|
| `ENTER_PLAY` | “let’s fuck around”, “go nuts”, “access the sandbox” | `SANDBOX_DRAFT` |
| `CAPTURE_THOUGHT` | “weird idea”, “catch this”, “dribble” | `SANDBOX_DRAFT` |
| `PUBLISH_PUBLICLY` | “show people”, “put this somewhere public” | `DRAFT_EXTERNAL` |
| `FORK_RESEARCH` | “fork this”, “fuck with this project” | `SANDBOX_WRITE` |
| `RUN_EXPERIMENT` | “try it”, “see what happens”, “test this” | `SANDBOX_WRITE` |
| `ADVERSARIAL_BREAK` | “break it”, “attack this properly” | `SANDBOX_WRITE` |
| `CREATE_ARTICLE` | “write this up”, “make an article” | `DRAFT_EXTERNAL` |
| `CREATE_COURSE_LESSON` | “teach this”, “put it in the course” | `SANDBOX_WRITE` |
| `PACKAGE_PROMOTION` | “could this help main?”, “package it” | `DRAFT_LAB_PR` |
| `REQUEST_LAB_REVIEW` | “ask Lab”, “make it real” | `DRAFT_LAB_PR` |

`DRAFT_LAB_PR` means prepare and request review. It never means approve or merge.

## Routing precedence

Specific intent outranks general play language. “Let’s fuck around and fork
this” routes to `FORK_RESEARCH`, not merely `ENTER_PLAY`. An active operator
hold outranks both. Lab-related language always routes to the bounded promotion
skill, and a held direction cannot be packaged for Lab while the hold remains
active.

## Provider neutrality

Any AI may implement this contract. Repository policy, GitHub permissions and branch protection provide authority; model personality does not.
