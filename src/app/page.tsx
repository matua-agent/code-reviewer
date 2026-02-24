"use client";

import { useState } from "react";
import type { ReviewResult, Category, Issue } from "@/lib/types";
import { CATEGORY_META, SEVERITY_META } from "@/lib/types";

const SAMPLE_CODE = `async function fetchUserData(userId) {
  const query = "SELECT * FROM users WHERE id = " + userId;
  const result = await db.query(query);
  
  if (result == null) {
    return null
  }
  
  const password = result.password
  const userData = {
    id: result.id,
    name: result.name,
    email: result.email,
    password: password
  }
  
  console.log("Fetched user:", userData)
  return userData
}

async function updateUser(userId, data) {
  const users = await fetchUserData(userId)
  users.name = data.name
  users.email = data.email
  await db.save(users)
  return users
}`;

const LANGUAGES = [
  "Auto-detect", "TypeScript", "JavaScript", "Python", "Go",
  "Rust", "Java", "C++", "C#", "Ruby", "PHP", "Swift",
];

const SEVERITY_ORDER = ["critical", "major", "minor", "info"] as const;

function ScoreRing({ score }: { score: number }) {
  const color =
    score >= 80 ? "#22c55e" : score >= 60 ? "#eab308" : score >= 40 ? "#f97316" : "#ef4444";
  const r = 32;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg className="rotate-[-90deg]" width="96" height="96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#27272a" strokeWidth="8" />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold" style={{ color }}>
          {score}
        </div>
        <div className="text-[10px] text-zinc-500 -mt-0.5">/ 100</div>
      </div>
    </div>
  );
}

function IssueBadge({ severity }: { severity: string }) {
  const meta = SEVERITY_META[severity as keyof typeof SEVERITY_META];
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${meta?.badge ?? ""}`}>
      {meta?.label ?? severity}
    </span>
  );
}

function IssueCard({ issue, onFix }: { issue: Issue; onFix: (issue: Issue) => void }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <IssueBadge severity={issue.severity} />
            {issue.line && (
              <span className="text-xs bg-zinc-800 text-zinc-400 border border-zinc-700 rounded px-2 py-0.5 font-mono">
                Line {issue.line}
              </span>
            )}
          </div>
          <p className="font-semibold text-sm text-zinc-100 mt-1.5">{issue.title}</p>
        </div>
        <button
          onClick={() => onFix(issue)}
          className="shrink-0 text-xs bg-violet-900/50 hover:bg-violet-800/60 text-violet-300 border border-violet-700/50 rounded px-2.5 py-1 transition-colors"
        >
          Fix →
        </button>
      </div>
      <p className="text-sm text-zinc-400">{issue.description}</p>
      <div className="bg-zinc-800/60 rounded p-2.5 border-l-2 border-violet-600/60">
        <p className="text-xs text-zinc-300 font-medium mb-0.5">Suggestion</p>
        <p className="text-xs text-zinc-400">{issue.suggestion}</p>
      </div>
    </div>
  );
}

export default function CodeReviewer() {
  const [code, setCode] = useState(SAMPLE_CODE);
  const [language, setLanguage] = useState("Auto-detect");
  const [reviewing, setReviewing] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [fixing, setFixing] = useState(false);
  const [fixedCode, setFixedCode] = useState<string | null>(null);
  const [showFix, setShowFix] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fixAll, setFixAll] = useState(false);

  async function runReview() {
    setReviewing(true);
    setError(null);
    setResult(null);
    setFixedCode(null);
    setShowFix(false);

    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        language: language === "Auto-detect" ? null : language,
      }),
    });

    if (!res.ok) {
      setError("Review failed — check the console");
      setReviewing(false);
      return;
    }

    const data = await res.json();
    if (data.error) {
      setError(data.error);
    } else {
      setResult(data);
    }
    setReviewing(false);
  }

  async function fixIssues(issues: Issue[], isFixAll = false) {
    setFixing(true);
    setFixedCode("");
    setShowFix(true);
    setFixAll(isFixAll);

    const res = await fetch("/api/fix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        language: result?.language ?? language,
        issues,
      }),
    });

    if (!res.ok || !res.body) {
      setFixing(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let acc = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6);
        if (raw === "[DONE]") break;
        try {
          const { text } = JSON.parse(raw);
          if (text) {
            acc += text;
            setFixedCode(acc);
          }
        } catch {}
      }
    }

    setFixing(false);
  }

  async function copyFixed() {
    if (!fixedCode) return;
    await navigator.clipboard.writeText(fixedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const categories = result
    ? ([...new Set(result.issues.map((i) => i.category))] as Category[])
    : [];

  const filteredIssues = result
    ? activeCategory === "all"
      ? [...result.issues].sort(
          (a, b) =>
            SEVERITY_ORDER.indexOf(a.severity as typeof SEVERITY_ORDER[number]) -
            SEVERITY_ORDER.indexOf(b.severity as typeof SEVERITY_ORDER[number])
        )
      : result.issues.filter((i) => i.category === activeCategory)
    : [];

  const criticalCount = result?.issues.filter((i) => i.severity === "critical").length ?? 0;
  const majorCount = result?.issues.filter((i) => i.severity === "major").length ?? 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Header */}
      <header className="border-b border-zinc-800/60 bg-zinc-900/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <span className="text-2xl">🔬</span> AI Code Reviewer
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Claude Haiku · Bugs, Security, Performance, Style
            </p>
          </div>
          <a
            href="https://github.com/matua-agent/code-reviewer"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-700 rounded px-3 py-1.5 transition-colors"
          >
            View Source
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className={`grid gap-6 ${result || reviewing ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 max-w-3xl mx-auto"}`}>
          {/* Left: Input */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 text-zinc-300"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-zinc-600">
                  {code.split("\n").length} lines
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setCode(SAMPLE_CODE); setLanguage("JavaScript"); }}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded px-3 py-1.5 transition-colors"
                >
                  Load sample
                </button>
                <button
                  onClick={runReview}
                  disabled={!code.trim() || reviewing}
                  className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-5 py-2 text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {reviewing ? (
                    <>
                      <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Reviewing...
                    </>
                  ) : (
                    "Review Code →"
                  )}
                </button>
              </div>
            </div>

            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-[300px] sm:h-[500px] bg-zinc-900 border border-zinc-700 rounded-lg p-4 font-mono text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none leading-relaxed placeholder:text-zinc-600"
              placeholder="Paste your code here..."
              spellCheck={false}
            />
          </div>

          {/* Right: Results */}
          {(result || reviewing || error) && (
            <div className="space-y-4">
              {reviewing && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 flex flex-col items-center justify-center gap-4 min-h-[200px]">
                  <svg className="animate-spin w-8 h-8 text-violet-400" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <p className="text-zinc-400 text-sm">Analyzing code...</p>
                </div>
              )}

              {error && (
                <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-4 text-sm text-red-400">
                  {error}
                </div>
              )}

              {result && (
                <>
                  {/* Score + Summary */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex gap-5 items-center">
                    <ScoreRing score={result.score} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-zinc-800 text-zinc-400 border border-zinc-700 rounded px-2 py-0.5">
                          {result.language}
                        </span>
                        {criticalCount > 0 && (
                          <span className="text-xs bg-red-950/40 text-red-400 border border-red-800/50 rounded px-2 py-0.5">
                            {criticalCount} critical
                          </span>
                        )}
                        {majorCount > 0 && (
                          <span className="text-xs bg-orange-950/40 text-orange-400 border border-orange-800/50 rounded px-2 py-0.5">
                            {majorCount} major
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-300 leading-relaxed">{result.summary}</p>
                    </div>
                  </div>

                  {/* Positives */}
                  {result.positives?.length > 0 && (
                    <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-lg px-4 py-3">
                      <p className="text-xs font-semibold text-emerald-400 mb-2">✓ What&apos;s good</p>
                      <ul className="space-y-0.5">
                        {result.positives.map((pos, i) => (
                          <li key={i} className="text-xs text-zinc-400">
                            • {pos}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Fix All */}
                  {result.issues.length > 0 && (
                    <button
                      onClick={() => fixIssues(result.issues, true)}
                      disabled={fixing}
                      className="w-full bg-violet-700 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      {fixing && fixAll ? (
                        <>
                          <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          Generating fix...
                        </>
                      ) : (
                        `✨ Fix All ${result.issues.length} Issues`
                      )}
                    </button>
                  )}

                  {/* Category tabs */}
                  {result.issues.length > 0 && (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setActiveCategory("all")}
                          className={`text-xs rounded px-3 py-1.5 border transition-colors ${
                            activeCategory === "all"
                              ? "bg-zinc-700 border-zinc-500 text-zinc-100"
                              : "bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          All ({result.issues.length})
                        </button>
                        {categories.map((cat) => {
                          const meta = CATEGORY_META[cat];
                          const count = result.issues.filter((i) => i.category === cat).length;
                          return (
                            <button
                              key={cat}
                              onClick={() => setActiveCategory(cat)}
                              className={`text-xs rounded px-3 py-1.5 border transition-colors ${
                                activeCategory === cat
                                  ? `${meta.color} font-semibold`
                                  : "bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-300"
                              }`}
                            >
                              {meta.icon} {meta.label} ({count})
                            </button>
                          );
                        })}
                      </div>

                      {/* Issue cards */}
                      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                        {filteredIssues.map((issue, i) => (
                          <IssueCard
                            key={i}
                            issue={issue}
                            onFix={(iss) => fixIssues([iss], false)}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {result.issues.length === 0 && (
                    <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-6 text-center">
                      <p className="text-2xl mb-2">✅</p>
                      <p className="text-emerald-400 font-semibold">No issues found</p>
                      <p className="text-zinc-500 text-sm mt-1">This code looks clean!</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Fixed Code Panel */}
        {showFix && (
          <div className="mt-6 bg-zinc-900 border border-violet-800/40 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-violet-400">
                  ✨ {fixAll ? "Fixed Code" : "Fixed Issue"}
                </span>
                {fixing && (
                  <span className="flex items-center gap-1 text-xs text-zinc-500">
                    <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    generating...
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={copyFixed}
                  disabled={!fixedCode || fixing}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded px-3 py-1.5 transition-colors disabled:opacity-40"
                >
                  {copied ? "Copied ✓" : "Copy"}
                </button>
                <button
                  onClick={() => setShowFix(false)}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
            <pre className="font-mono text-sm text-zinc-300 p-5 overflow-x-auto max-h-[400px] overflow-y-auto leading-relaxed">
              <code>{fixedCode}
                {fixing && <span className="inline-block w-1.5 h-4 bg-violet-400 ml-0.5 animate-pulse" />}
              </code>
            </pre>
          </div>
        )}
      </main>
    </div>
  );
}
