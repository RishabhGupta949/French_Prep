#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_INPUT = path.join(ROOT, "ai-chat-history", "raw", "phase-0-to-3-session.json");
const DEFAULT_OUTDIR = path.join(ROOT, "ai-chat-history");
const TIME_ZONE = "Asia/Kolkata";
const ZONE_LABEL = "IST";

function parseArgs(argv) {
  const args = { input: DEFAULT_INPUT, outdir: DEFAULT_OUTDIR, output: null, list: false, whole: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--list") args.list = true;
    else if (a === "--input") args.input = path.resolve(argv[++i]);
    else if (a === "--outdir") args.outdir = path.resolve(argv[++i]);
    else if (a === "--output") args.output = path.resolve(argv[++i]);
    else if (a === "--whole-session") args.whole = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

const istFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function formatIst(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "unknown time";
  const parts = Object.fromEntries(
    istFormatter.formatToParts(new Date(ms)).map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} ${ZONE_LABEL}`;
}

function fenceFor(content) {
  const text = String(content);
  let longest = 0;
  const runs = text.match(/`+/g);
  if (runs) for (const run of runs) longest = Math.max(longest, run.length);
  return "`".repeat(Math.max(4, longest + 1));
}

function fenced(content, lang) {
  const fence = fenceFor(content);
  return `${fence}${lang || ""}\n${content}\n${fence}`;
}

function details(summary, body) {
  return `<details>\n<summary>${summary}</summary>\n\n${body}\n\n</details>`;
}

function jsonBlock(value) {
  let text;
  try {
    text = JSON.stringify(value, null, 2);
  } catch {
    text = String(value);
  }
  if (text === undefined) text = "undefined";
  return fenced(text, "json");
}

function textOf(message) {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}

function normalizeInline(text) {
  return String(text).replace(/\s+/g, " ").trim();
}

function renderToolPart(part) {
  const state = part.state || {};
  const input = state.input !== undefined ? state.input : {};
  const lines = [];
  lines.push(`**Tool:** \`${part.tool}\``);
  lines.push("");
  lines.push("**Input**");
  lines.push("");
  lines.push(jsonBlock(input));

  if (state.status === "error" || state.error !== undefined) {
    lines.push("");
    lines.push(`**Error** (status: ${state.status || "error"})`);
    lines.push("");
    lines.push(jsonBlock(state.error));
  }

  if (state.output !== undefined) {
    const output = String(state.output);
    lines.push("");
    lines.push(`**Output** (${output.length} chars)`);
    lines.push("");
    lines.push(fenced(output, "text"));
  } else if (state.status === "completed") {
    lines.push("");
    lines.push("_No output text._");
  } else if (state.status) {
    lines.push("");
    lines.push(`_Status: ${state.status}_`);
  }

  return details(`Tool call — ${part.tool}`, lines.join("\n"));
}

function renderPart(part, index, total) {
  switch (part.type) {
    case "text": {
      const text = part.text === "" ? "_Empty text part._" : part.text;
      return text;
    }
    case "reasoning": {
      const text = part.text === "" ? "_Empty reasoning part._" : part.text;
      return details("Reasoning", fenced(text, "text"));
    }
    case "tool":
      return renderToolPart(part);
    case "compaction":
      return "_Automatic compaction marker (session context was summarised here)._\n\n" +
        details("Compaction metadata", jsonBlock({ type: part.type, auto: part.auto }));
    case "step-start":
      return "_Step started._";
    case "step-finish": {
      const meta = { reason: part.reason, tokens: part.tokens, cost: part.cost };
      return details("Step finished", jsonBlock(meta));
    }
    case "file": {
      return details("File part", jsonBlock(part));
    }
    case "patch": {
      return details("Patch part", jsonBlock(part));
    }
    default: {
      return details(`Unhandled part type: ${part.type}`, jsonBlock(part));
    }
  }
}

function renderMessage(message, number) {
  const role = message.info.role === "user" ? "USER" : "ASSISTANT";
  const created = message.info.time && message.info.time.created;
  const completed = message.info.time && message.info.time.completed;
  const meta = [`**Time:** ${formatIst(created)}`];
  if (completed) meta.push(`**Completed:** ${formatIst(completed)}`);
  if (message.info.modelID) meta.push(`**Model:** \`${message.info.modelID}\``);
  if (message.info.agent) meta.push(`**Agent:** \`${message.info.agent}\``);
  meta.push(`**Message ID:** \`${message.info.id || "unknown"}\``);

  const body = message.parts.length
    ? message.parts.map((p, i) => renderPart(p, i, message.parts.length)).join("\n\n")
    : "_No content parts._";

  return [
    `## Message ${number} — ${role}`,
    "",
    meta.join("  \n"),
    "",
    body,
    "",
    "---",
    "",
  ].join("\n");
}

function detectPhaseStarts(messages) {
  const starts = {};
  messages.forEach((message, index) => {
    if (message.info.role !== "user") return;
    const text = normalizeInline(textOf(message));
    const stripped = text.replace(/^#+\s*/, "");
    const match = stripped.match(/^Phase\s*([123])\b/i);
    if (!match) return;
    const phase = Number(match[1]);
    if (!starts[phase]) starts[phase] = index;
  });
  return starts;
}

function header({ sessionId, title, phaseName, from, to, count, rawPath, total }) {
  return [
    `# FrenchPrep — AI Chat History — ${phaseName}`,
    "",
    `- **Session title:** ${title}`,
    `- **Session ID:** \`${sessionId}\``,
    `- **Messages:** ${from === null ? "none" : `${from}–${to}`} (${count} of ${total})`,
    `- **Time zone:** ${TIME_ZONE} (${ZONE_LABEL})`,
    `- **Raw export:** \`${path.relative(ROOT, rawPath).replace(/\\/g, "/")}\` (read-only, unmodified)`,
    `- **Generated:** ${formatIst(Date.now())}`,
    "",
    "> This file is a verbatim rendering of the exported session. Message text is not summarised, shortened or reworded.",
    "> Reasoning and tool calls are collapsed in `<details>` blocks so no content is lost.",
    "",
    "---",
    "",
  ].join("\n");
}

function wholeHeader({ sessionId, title, from, to, count, total, rawPath }) {
  const rel = path.relative(ROOT, rawPath).replace(/\\/g, "/");
  return [
    "# FrenchPrep — AI Chat History — Session Export (whole session)",
    "",
    `- **Source:** \`${rel}\` (session ${sessionId}). Unedited content, formatted only.`,
    `- **Session title:** ${title}`,
    `- **Session ID:** \`${sessionId}\``,
    `- **Messages:** ${from}–${to} (${count} of ${total}), 1-based relative to this raw file`,
    `- **Time zone:** ${TIME_ZONE} (${ZONE_LABEL})`,
    `- **Raw export:** \`${rel}\` (read-only, unmodified)`,
    `- **Generated:** ${formatIst(Date.now())}`,
    "",
    "> This file is a verbatim rendering of the exported session. Message text is not summarised, shortened or reworded.",
    "> Reasoning and tool calls are collapsed in `<details>` blocks so no content is lost.",
    "",
    "---",
    "",
  ].join("\n");
}

function buildPhaseFile(phaseName, messages, range, meta) {
  const count = range ? range.to - range.from + 1 : 0;
  const parts = [
    header({
      sessionId: meta.sessionId,
      title: meta.title,
      phaseName,
      from: range ? range.from : null,
      to: range ? range.to : null,
      count,
      rawPath: meta.rawPath,
      total: meta.total,
    }),
  ];
  if (!range) {
    parts.push(`_No messages for ${phaseName} exist in this session._`);
    parts.push("");
  } else {
    for (let i = range.from; i <= range.to; i++) {
      parts.push(renderMessage(messages[i - 1], i));
    }
  }
  return parts.join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node scripts/split-chat.cjs [--list] [--input <json>] [--outdir <dir>]");
    return;
  }

  const raw = fs.readFileSync(args.input, "utf8");
  const data = JSON.parse(raw);
  const messages = data.messages;
  if (!Array.isArray(messages)) throw new Error("Raw JSON has no messages array");

  const sessionId = (data.info && data.info.id) || "unknown";
  const title = (data.info && data.info.title) || "unknown";
  const total = messages.length;

  if (args.list) {
    console.log(`Session: ${sessionId} — ${title}`);
    console.log(`Messages: ${total}`);
    console.log("");
    messages.forEach((message, index) => {
      if (message.info.role !== "user") return;
      const prompt = normalizeInline(textOf(message));
      console.log(
        `Message ${index + 1}  |  ${prompt.length} chars  |  ${prompt.slice(0, 90)}`
      );
    });
    return;
  }

  const starts = detectPhaseStarts(messages);
  console.log("Detected phase starts:");
  for (const phase of [1, 2, 3]) {
    if (starts[phase] === undefined) {
      console.log(`  Phase ${phase}: not found`);
      continue;
    }
    const index = starts[phase];
    console.log(
      `  Phase ${phase}: message ${index + 1} — ${normalizeInline(textOf(messages[index])).slice(0, 120)}`
    );
  }
  console.log("");

  if (args.output) {
    if (!args.whole) throw new Error("--output requires --whole-session");
    fs.mkdirSync(path.dirname(args.output), { recursive: true });
    const lines = [wholeHeader({ sessionId, title, from: 1, to: total, count: total, total, rawPath: args.input })];
    for (let i = 1; i <= total; i++) lines.push(renderMessage(messages[i - 1], i));
    fs.writeFileSync(args.output, lines.join("\n"), "utf8");
    const content = fs.readFileSync(args.output, "utf8");
    let missing = 0;
    for (const m of messages) for (const p of m.parts) if (p.type === "text" && p.text && !content.includes(p.text)) { missing++; console.log("MISSING", m.info.id, p.text.slice(0, 60)); }
    const findLongest = (role) => { let best = null; messages.forEach((m, idx) => { if (m.info.role !== role) return; const t = textOf(m); if (!best || t.length > best.text.length) best = { index: idx, text: t }; }); return best; };
    console.log("Raw JSON messages:", total);
    console.log("Markdown messages (whole session):", total);
    console.log("Counts match: true");
    console.log("Text parts missing from markdown:", missing);
    console.log("");
    for (const role of ["user", "assistant"]) {
      const longest = findLongest(role);
      if (!longest) { console.log(`  ${role}: none`); continue; }
      console.log(`  ${role}: message ${longest.index + 1}, ${longest.text.length} chars, present verbatim: ${content.includes(longest.text)}`);
      if (!content.includes(longest.text)) throw new Error(`Spot check failed for ${role} message ${longest.index + 1}`);
    }
    console.log("");
    console.log("Wrote", args.output);
    return;
  }

  const phase1Start = starts[1];
  if (phase1Start === undefined) {
    throw new Error("Could not locate the start of Phase 1 in the user prompts");
  }

  const ranges = {
    "phase-0-setup.md": { name: "Phase 0 — Setup and Foundation", from: 1, to: phase1Start },
    "phase-1.md": {
      name: "Phase 1 — Authentication & Onboarding",
      from: phase1Start + 1,
      to: starts[2] !== undefined ? starts[2] : total,
    },
    "phase-2.md": {
      name: "Phase 2",
      from: starts[2] !== undefined ? starts[2] + 1 : null,
      to: starts[3] !== undefined ? starts[3] : starts[2] !== undefined ? total : null,
    },
    "phase-3.md": {
      name: "Phase 3",
      from: starts[3] !== undefined ? starts[3] + 1 : null,
      to: starts[3] !== undefined ? total : null,
    },
  };

  if (ranges["phase-0-setup.md"].to < 1) delete ranges["phase-0-setup.md"];

  fs.mkdirSync(args.outdir, { recursive: true });

  const written = [];
  let writtenMessages = 0;
  for (const [filename, range] of Object.entries(ranges)) {
    const hasRange = range.from !== null && range.to !== null && range.to >= range.from;
    const effective = hasRange ? range : { ...range, from: null, to: null };
    const content = buildPhaseFile(effective.name, messages, hasRange ? effective : null, {
      sessionId,
      title,
      rawPath: args.input,
      total,
    });
    const outPath = path.join(args.outdir, filename);
    fs.writeFileSync(outPath, content, "utf8");
    const count = hasRange ? effective.to - effective.from + 1 : 0;
    writtenMessages += count;
    written.push({ filename, path: outPath, count, from: effective.from, to: effective.to, bytes: Buffer.byteLength(content, "utf8") });
  }

  console.log("Raw JSON messages:", total);
  console.log("Markdown messages:", writtenMessages);
  console.log("Counts match:", writtenMessages === total);
  console.log("");
  for (const w of written) {
    const range = w.from === null ? "no messages" : `${w.from}–${w.to}`;
    console.log(`${w.filename}  |  ${w.count} messages  |  ${range}  |  ${w.bytes} bytes`);
  }
  console.log("");

  if (writtenMessages !== total) {
    throw new Error(`Message count mismatch: raw=${total}, markdown=${writtenMessages}`);
  }

  const phaseFileFor = (messageIndex) => {
    const n = messageIndex + 1;
    if (ranges["phase-0-setup.md"] && n <= ranges["phase-0-setup.md"].to) {
      return "phase-0-setup.md";
    }
    if (starts[2] !== undefined && n >= starts[2] + 1) {
      if (starts[3] !== undefined && n >= starts[3] + 1) return "phase-3.md";
      return "phase-2.md";
    }
    return "phase-1.md";
  };

  const findLongest = (role) => {
    let best = null;
    messages.forEach((message, index) => {
      if (message.info.role !== role) return;
      const text = textOf(message);
      if (!best || text.length > best.text.length) best = { index, text };
    });
    return best;
  };

  console.log("Spot checks (longest verbatim text must appear in full):");
  for (const role of ["user", "assistant"]) {
    const longest = findLongest(role);
    if (!longest) {
      console.log(`  ${role}: none`);
      continue;
    }
    const filename = phaseFileFor(longest.index);
    const content = fs.readFileSync(path.join(args.outdir, filename), "utf8");
    const present = content.includes(longest.text);
    console.log(
      `  ${role}: message ${longest.index + 1}, ${longest.text.length} chars, file ${filename}, present verbatim: ${present}`
    );
    if (!present) throw new Error(`Spot check failed for ${role} message ${longest.index + 1}`);
  }
}

main();
