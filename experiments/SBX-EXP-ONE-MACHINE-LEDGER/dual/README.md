# Dual implementation — Python

Independent OML kernel that **must** reproduce `fixtures/chain-v0.json` anchors.

```bash
python3 dual/python/verify_fixture.py
# or
npm run dual
```

If Node and Python disagree, the experiment is broken. That is the point.

Requires: Python 3.10+, `cryptography` (Ed25519 verify).

`status_authority: NONE`
