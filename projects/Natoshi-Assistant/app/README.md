# Natoshi-Assistant app (Matrix Terminal)

Always-on-top Matrix chat overlay.

## Run

```bash
./launch.sh
# or
python3 matrix_terminal.py
```

## Controls

| Action | How |
|--------|-----|
| Drag | Title bar |
| Resize | Window edges or bottom-right `◢` |
| Always on top | Checkbox or `/top` |
| Send | Enter |
| Newline | Shift+Enter |
| Minimize | Esc |

## Commands

```
/help
/search <query>
/remind 10m message
/remind 14:30 message
/reminders
/cancel [id]
/provider ollama|xai|deepseek|openai|custom
/model <name>
/models
/opacity 0.9
/clear
/sys <system prompt>
```

## Config (local, not committed)

On first run, `config.json` may appear beside the script. Prefer moving personal state to `~/.config/` in a future improvement (see `../IMPROVE_ME.md` P0-4).

Keys: export in shell or `~/.config/matrix-terminal.env` (sourced by `launch.sh`).
