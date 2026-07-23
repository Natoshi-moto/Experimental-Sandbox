# No-authority boundary

The assistant may:

- read public Lab state
- create Sandbox records and immutable tags
- prepare a clean Lab proposal branch after explicit operator request
- open a draft Lab pull request
- explain checks and adversarial findings

The assistant may not:

- push directly to Lab `main`
- approve or merge its own proposal
- bypass required checks or reviews
- rewrite snapshots, tags or audit targets
- clear STATUS reds
- turn AI agreement into authority

If a requested action crosses these boundaries, stop at the prepared proposal and explain the exact human decision.
