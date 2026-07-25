# Security & safety notes — Natoshi-Assistant

**status_authority:** `NONE`  
This is a **local single-operator overlay**, not a hardened multi-user product.

## Secrets

- API keys **only** via environment variables (`XAI_API_KEY`, `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, `CUSTOM_API_KEY`).  
- Optional file: `~/.config/matrix-terminal.env` (gitignored on purpose; never commit).  
- Do **not** put keys in `config.json` in this repo.  
- `history.jsonl` may contain sensitive chat — keep out of git (local only).

## Network

| Path | Network |
|------|---------|
| Ollama | localhost only by default |
| Cloud chat | HTTPS to configured base_url when key present |
| `/search` | HTTPS to DuckDuckGo HTML |

Search results are **untrusted text**. Treat them as prompt-injection surface when fed to a model.

## Desktop

- Always-on-top can obscure security dialogs — operator responsibility.  
- Reminders use `notify-send` when present.  
- No shell tool execution from model output in v0.  

## Cancelled machinery (do not revive here)

The operator cancelled “security alarm setup” temporary scripts and related jobs.  
This project is a **replacement UX direction** (gentle reminders + chat), not a continuation of that setup.

## Lab boundary

- No Lab credentials.  
- No submodule into Lab.  
- Promotion to Lab requires separate Promotion Gate package + operator `ASK LAB`.  
