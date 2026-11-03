# Vendored copy of Impeccable

- Source: https://github.com/pbakaus/impeccable (skill folder `.claude/skills/impeccable`, version 4.7.0, commit 46b822f, engine 0.1.16)
- License: Apache 2.0 (see LICENSE and NOTICE.md)
- Local change: added `disable-model-invocation: true` to SKILL.md so the skill only runs when the user types `/impeccable ...`. Agents use the detector script and `reference/craft-floor.md` directly instead.
- `scripts/impeccable.cmd` converted to CRLF line endings for Windows cmd.
- Design hooks are not installed.
