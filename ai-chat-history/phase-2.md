# Phase 2 — Author note (not chat history)

**Note written by the author, not chat history.** This file contains no OpenCode conversation.

## Why this file is a note instead of a chat export

When the first OpenCode session (`raw/phase-0-to-3-session.json`, "FrenchPrep Phase 0: Repository setup and PRD review") was split, the splitter's phase detection was anchored on user prompts that start with a heading like `# Phase` or `### Sprint`. That session only contains one such prompt — `# Phase 1 — Authentication & Onboarding` (message 314 of 457) — so its messages landed in `phase-0-setup.md` (messages 1–313) and `phase-1.md` (messages 314–457) under shifted phase labels: what the splitter called "Phase 1" is really Phase 0/Foundation work, and no separate Phase 2 chat exists for a file named `phase-2.md`.

Nothing was removed. Every message from both exported OpenCode sessions is accounted for:

- `ai-chat-history/phase-0-setup.md` — 313 messages (1–313) from `raw/phase-0-to-3-session.json`
- `ai-chat-history/phase-1.md` — 144 messages (314–457) from `raw/phase-0-to-3-session.json`
- `ai-chat-history/phase-3.md` — 110 messages (1–110) from `raw/phase-2-to-3-session.json`
- Raw JSON exports (unedited): `ai-chat-history/raw/phase-0-to-3-session.json` (457 messages) and `ai-chat-history/raw/phase-2-to-3-session.json` (110 messages)

Message numbers in all Markdown files are 1-based and relative to the raw JSON file that file was generated from.

## Table: files, raw sources, and heading-style user prompts

The table below lists every user prompt that starts with a heading like `# Phase` or `### Sprint`, taken directly from the raw JSON files (not from memory).

| Markdown file | Raw JSON source | Messages in file | Heading-style user prompts (message number — first line) |
|---|---|---|---|
| `phase-0-setup.md` | `raw/phase-0-to-3-session.json` | 1–313 (313 messages) | none |
| `phase-1.md` | `raw/phase-0-to-3-session.json` | 314–457 (144 messages) | 314 — `# Phase 1 — Authentication & Onboarding` |
| `phase-3.md` | `raw/phase-2-to-3-session.json` | 1–110 (110 messages) | 1 — `# Phase 3 — Sprint 3.4: Exercise Evaluation Engine`<br>21 — `# Phase 3 — Sprint 3.5: Lesson Attempts & Completion`<br>53 — `### Sprint 3.6 — Learning Path Frontend`<br>65 — `### Sprint 3.7 — Lesson Player & Exercise UI`<br>76 — `### Sprint 3.8 — Lesson Results Screen`<br>108 — `### Sprint 3.9 — Final Integration Verification` |

Raw sessions:
- `raw/phase-0-to-3-session.json` — session `ses_e05ff3142ffeSqF7OLKFYcaErD`, "FrenchPrep Phase 0: Repository setup and PRD review", 457 messages.
- `raw/phase-2-to-3-session.json` — session `ses_e017e7ef2ffeyFFwtf2RRuwwMO`, "Sprint 3.4 exercise evaluation engine", 110 messages (Sprint 3.4 onward).
