# AI Code Reviewer

Paste any code. Get structured AI review in seconds.

**Live:** https://code-reviewer-beta-six.vercel.app

## What It Does

- **Paste code** in any of 12 languages (or let it auto-detect)
- **Review** runs via Claude Haiku and returns a structured JSON analysis
- **Score** (0–100) displayed as a visual ring with color coding
- **Issues** categorized by type: 🐛 Bugs, 🔒 Security, ⚡ Performance, 🧠 Logic, 🧹 Style, 📝 Docs
- **Severity** levels: Critical, Major, Minor, Info
- **Fix** any single issue or all issues at once — corrected code streams in real-time
- **Filter** by category via tabs

## Tech Stack

- **Next.js 16** (App Router)
- **Claude Haiku** — for structured review (JSON) and streaming fix generation
- **TypeScript** — typed interfaces for all review output
- **Tailwind v4**

## Architecture

### Structured JSON Review
The `/api/review` endpoint enforces a strict JSON schema via Claude's system prompt:
- `no markdown, no explanation` constraint prevents wrapping
- Enum constraints on `category` and `severity` ensure consistent values  
- Fallback regex strips markdown fencing if present
- Response is typed with `ReviewResult` TypeScript interface

### Streaming Fix Generation
The `/api/fix` endpoint streams corrected code via SSE:
- Accepts either a single issue (targeted fix) or all issues (full refactor)
- Streams using `ReadableStream` with `text/event-stream` headers
- UI renders streaming code in a panel with cursor animation + copy button

## Local Development

```bash
npm install
echo "ANTHROPIC_API_KEY=your_key" > .env.local
npm run dev
```

## Sample Code (pre-loaded)

The default sample demonstrates common patterns reviewers catch:
- **SQL injection** via string concatenation (`"SELECT * FROM users WHERE id = " + userId`)
- **Data exposure** — password included in the returned object
- **Null safety** — `result == null` instead of `result === null`
- **Missing error handling** — no try/catch on async db calls
- **Console.log** in production code

Run the review to see Claude catch all of these with specific line references and fixes.

## Interview Angle

Built as a demonstration of:
1. **Reliable structured output from Claude** — the system prompt design that makes JSON consistent
2. **Dual-mode generation** — sync structured output + async streaming in the same tool
3. **Developer tooling** — practical UX that makes triage fast (score → severity badges → categories → fix)

---

Built by [Harrison Dudley-Rode](https://dudleyrode.com) · [matua-agent](https://github.com/matua-agent)
