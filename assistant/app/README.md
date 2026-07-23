# Mithub Adjacent browser prototype

A dependency-free local interface for the assistant router.

```bash
cd assistant/app
python3 -m http.server 4174
```

The profile, draft and router log remain in browser `localStorage`. This is intentionally not presented as secure authentication. It configures experience; GitHub permissions enforce authority.

The app has no network calls, credentials or Nexus Lab write path.
