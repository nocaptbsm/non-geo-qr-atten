import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Users, Activity, LogIn, LogOut, Download, Search, ShieldCheck, KeyRound, Trash2, Sparkles, Radio,
} from "lucide-react";
import { AuroraBackground } from "@/components/AuroraBackground";
import { SiteHeader } from "@/components/SiteHeader";
import { store, type AttendanceLog } from "@/lib/store";

const ADMIN_PASSCODE = "pulse2026"; // demo passcode; swap for proper auth later
const SESSION_KEY = "qr_admin_session";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin · Pulse.QR" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    setAuthed(typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY) === "ok");
  }, []);

  return (
    <div className="relative min-h-screen">
      <AuroraBackground />
      <SiteHeader />
      <AnimatePresence mode="wait">
        {authed ? <Dashboard key="d" onLogout={() => { sessionStorage.removeItem(SESSION_KEY); setAuthed(false); }} /> : <Gate key="g" onPass={() => setAuthed(true)} />}
      </AnimatePresence>
    </div>
  );
}

// ----- Passcode Gate -----
function Gate({ onPass }: { onPass: () => void }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === ADMIN_PASSCODE) {
      sessionStorage.setItem(SESSION_KEY, "ok");
      onPass();
      toast.success("Welcome, organiser");
    } else {
      setErr("Incorrect passcode");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-20"
    >
      <div className="glass-strong w-full rounded-3xl p-8 shadow-[var(--shadow-elevated)]">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--gradient-neon)] shadow-[var(--shadow-glow-cyan)]">
          <KeyRound className="h-5 w-5 text-background" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold">Admin access</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter the shared organiser passcode to open the dashboard.</p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            type="password"
            autoFocus
            value={code}
            onChange={(e) => { setCode(e.target.value); setErr(""); }}
            placeholder="••••••••"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm tracking-widest text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-[var(--neon-cyan)]/50 focus:ring-2 focus:ring-[var(--neon-cyan)]/20"
          />
          {err && <p className="text-xs text-destructive">{err}</p>}
          <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--gradient-neon)] px-4 py-3 text-sm font-semibold text-background shadow-[var(--shadow-glow-cyan)]">
            Unlock dashboard
          </button>
        </form>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Demo passcode: <span className="font-mono text-foreground">pulse2026</span>
        </p>
      </div>
    </motion.div>
  );
}

// ----- Dashboard -----
function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [tick, setTick] = useState(0); // re-render trigger
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<string>(""); // YYYY-MM-DD or empty

  // Subscribe to store changes + live time
  useEffect(() => {
    const onChange = () => setTick((t) => t + 1);
    window.addEventListener("qr-store-change", onChange);
    window.addEventListener("storage", onChange);
    const id = setInterval(onChange, 5000);
    return () => {
      window.removeEventListener("qr-store-change", onChange);
      window.removeEventListener("storage", onChange);
      clearInterval(id);
    };
  }, []);

  const users = useMemo(() => store.getUsers(), [tick]);
  const logs = useMemo(() => store.getLogs(), [tick]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todaysLogs = logs.filter((l) => new Date(l.check_in_time) >= today);
  const currentlyIn = logs.filter((l) => !l.check_out_time);
  const newUsersToday = users.filter((u) => new Date(u.created_at) >= today);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...logs]
      .filter((l) => {
        if (dateFilter) {
          const d = new Date(l.check_in_time).toISOString().slice(0, 10);
          if (d !== dateFilter) return false;
        }
        if (q) {
          return l.user_name.toLowerCase().includes(q) || l.registration_no.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => +new Date(b.check_in_time) - +new Date(a.check_in_time));
  }, [logs, query, dateFilter]);

  const exportCsv = () => {
    const rows = [
      ["Name", "Reg No", "Check In", "Check Out", "Device", "Token"],
      ...filtered.map((l) => [
        l.user_name, l.registration_no, l.check_in_time, l.check_out_time ?? "", l.device_id, l.token,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `attendance-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported", { description: `${filtered.length} rows` });
  };

  // Last 7 days activity for chart
  const series = useMemo(() => {
    const arr: { label: string; checkIns: number; checkOuts: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const dayLogs = logs.filter((l) => {
        const t = new Date(l.check_in_time);
        return t >= d && t < next;
      });
      arr.push({
        label: d.toLocaleDateString([], { weekday: "short" }),
        checkIns: dayLogs.length,
        checkOuts: dayLogs.filter((l) => l.check_out_time).length,
      });
    }
    return arr;
  }, [logs]);
  const maxBar = Math.max(1, ...series.map((s) => s.checkIns));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-7xl px-4 py-10">
      {/* Top bar */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-[var(--neon-cyan)]">
            <ShieldCheck className="h-3.5 w-3.5" /> control room
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
            Live <span className="text-gradient">attendance</span> dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time view of every scan, every check-in, every device.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { store.seedDemo(); toast.success("Demo data seeded"); }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-foreground hover:bg-white/10"
          >
            <Sparkles className="h-3.5 w-3.5" /> Seed demo
          </button>
          <button
            onClick={() => { if (confirm("Wipe all local data?")) { store.reset(); toast.success("Reset"); } }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-foreground hover:bg-destructive/15 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" /> Reset
          </button>
          <button
            onClick={onLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-white/10 hover:text-foreground"
          >
            Lock
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="New users today" value={newUsersToday.length} accent="cyan" />
        <StatCard icon={LogIn} label="Check-ins today" value={todaysLogs.length} accent="green" />
        <StatCard icon={Radio} label="Currently checked in" value={currentlyIn.length} accent="magenta" live />
        <StatCard icon={Activity} label="Total users" value={users.length} accent="violet" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* 7-day bar chart */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">last 7 days</div>
              <h3 className="mt-1 font-display text-lg font-semibold">Check-in activity</h3>
            </div>
            <div className="font-mono text-xs text-muted-foreground">{logs.length} total scans</div>
          </div>
          <div className="mt-6 flex h-44 items-end gap-3">
            {series.map((s) => {
              const h = (s.checkIns / maxBar) * 100;
              return (
                <div key={s.label} className="group flex flex-1 flex-col items-center gap-2">
                  <div className="relative flex h-full w-full items-end">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(2, h)}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="w-full rounded-t-md bg-[var(--gradient-neon)] opacity-70 transition group-hover:opacity-100"
                    />
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-mono opacity-0 group-hover:opacity-100">
                      {s.checkIns}
                    </div>
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live feed */}
        <div className="glass rounded-2xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                </span>
                live feed
              </div>
              <h3 className="mt-1 font-display text-lg font-semibold">Recent activity</h3>
            </div>
          </div>
          <div className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight: 240 }}>
            {logs.length === 0 && <EmptyMini text="No scans yet" />}
            {[...logs]
              .sort((a, b) => +new Date(b.check_out_time ?? b.check_in_time) - +new Date(a.check_out_time ?? a.check_in_time))
              .slice(0, 12)
              .map((l) => <FeedRow key={l.id} log={l} />)}
          </div>
        </div>
      </div>

      {/* Filters + table */}
      <div className="glass mt-6 rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold">Attendance history</h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or reg no…"
                className="w-56 rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-xs outline-none placeholder:text-muted-foreground focus:border-[var(--neon-cyan)]/40"
              />
            </div>
            <input
              type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-foreground outline-none focus:border-[var(--neon-cyan)]/40"
            />
            <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-2 text-xs font-medium text-foreground hover:bg-white/10">
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="pb-3 text-left font-medium">User</th>
                <th className="pb-3 text-left font-medium">Reg No</th>
                <th className="pb-3 text-left font-medium">Check In</th>
                <th className="pb-3 text-left font-medium">Check Out</th>
                <th className="pb-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">No records match your filter.</td></tr>
              )}
              {filtered.map((l) => (
                <tr key={l.id} className="border-t border-white/5 transition hover:bg-white/[0.03]">
                  <td className="py-3 pr-2">
                    <div className="flex items-center gap-3">
                      <Avatar name={l.user_name} />
                      <span className="font-medium text-foreground">{l.user_name}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-2 font-mono text-xs text-muted-foreground">{l.registration_no}</td>
                  <td className="py-3 pr-2 font-mono text-xs">{fmt(l.check_in_time)}</td>
                  <td className="py-3 pr-2 font-mono text-xs">{l.check_out_time ? fmt(l.check_out_time) : <span className="text-muted-foreground">—</span>}</td>
                  <td className="py-3">
                    {l.check_out_time
                      ? <Pill tone="magenta">checked out</Pill>
                      : <Pill tone="green">in session</Pill>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-10 text-center text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">← back to homepage</Link>
      </div>
    </motion.div>
  );
}

// ----- small UI helpers -----

function StatCard({
  icon: Icon, label, value, accent, live,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; accent: "cyan" | "magenta" | "green" | "violet"; live?: boolean }) {
  const colour =
    accent === "magenta" ? "var(--neon-magenta)" :
    accent === "green" ? "var(--success)" :
    accent === "violet" ? "var(--neon-violet)" :
    "var(--neon-cyan)";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass relative overflow-hidden rounded-2xl p-5"
    >
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20 blur-2xl" style={{ background: colour }} />
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5" style={{ color: colour }}>
          <Icon className="h-4 w-4" />
        </div>
        {live && (
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: colour }} /> live
          </span>
        )}
      </div>
      <div className="mt-4 font-mono text-4xl font-bold tabular-nums" style={{ color: colour }}>{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </motion.div>
  );
}

function FeedRow({ log }: { log: AttendanceLog }) {
  const isOut = !!log.check_out_time;
  const when = isOut ? log.check_out_time! : log.check_in_time;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-2.5"
    >
      <Avatar name={log.user_name} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{log.user_name}</div>
        <div className="text-[10px] text-muted-foreground">{log.registration_no} · {fmt(when)}</div>
      </div>
      {isOut
        ? <span className="flex items-center gap-1 rounded-full bg-[var(--neon-magenta)]/15 px-2 py-1 text-[10px] font-medium text-[var(--neon-magenta)]"><LogOut className="h-3 w-3" /> out</span>
        : <span className="flex items-center gap-1 rounded-full bg-[var(--success)]/15 px-2 py-1 text-[10px] font-medium text-[var(--success)]"><LogIn className="h-3 w-3" /> in</span>}
    </motion.div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--gradient-neon)] text-[10px] font-bold text-background">
      {initials}
    </div>
  );
}

function Pill({ tone, children }: { tone: "green" | "magenta"; children: React.ReactNode }) {
  const colour = tone === "green" ? "var(--success)" : "var(--neon-magenta)";
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest" style={{ background: `${colour}22`, color: colour }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: colour }} />
      {children}
    </span>
  );
}

function EmptyMini({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-white/10 py-8 text-center text-xs text-muted-foreground">{text}</div>;
}

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
