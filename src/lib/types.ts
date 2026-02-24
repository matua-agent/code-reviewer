export type Severity = "critical" | "major" | "minor" | "info";
export type Category =
  | "bugs"
  | "security"
  | "performance"
  | "style"
  | "documentation"
  | "logic";

export interface Issue {
  category: Category;
  severity: Severity;
  title: string;
  description: string;
  line?: number | null;
  suggestion: string;
}

export interface ReviewResult {
  summary: string;
  score: number; // 0-100
  issues: Issue[];
  positives: string[];
  language: string;
}

export const CATEGORY_META: Record<
  Category,
  { icon: string; label: string; color: string }
> = {
  bugs: { icon: "🐛", label: "Bugs", color: "text-red-400 border-red-800/50 bg-red-950/20" },
  security: { icon: "🔒", label: "Security", color: "text-orange-400 border-orange-800/50 bg-orange-950/20" },
  performance: { icon: "⚡", label: "Performance", color: "text-yellow-400 border-yellow-800/50 bg-yellow-950/20" },
  logic: { icon: "🧠", label: "Logic", color: "text-violet-400 border-violet-800/50 bg-violet-950/20" },
  style: { icon: "🧹", label: "Style", color: "text-blue-400 border-blue-800/50 bg-blue-950/20" },
  documentation: { icon: "📝", label: "Docs", color: "text-emerald-400 border-emerald-800/50 bg-emerald-950/20" },
};

export const SEVERITY_META: Record<
  Severity,
  { label: string; badge: string }
> = {
  critical: { label: "Critical", badge: "bg-red-500/20 text-red-400 border border-red-700/50" },
  major: { label: "Major", badge: "bg-orange-500/20 text-orange-400 border border-orange-700/50" },
  minor: { label: "Minor", badge: "bg-yellow-500/20 text-yellow-400 border border-yellow-700/50" },
  info: { label: "Info", badge: "bg-zinc-700/50 text-zinc-400 border border-zinc-600/50" },
};
