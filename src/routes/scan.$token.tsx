import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, Loader2, Clock, LogIn, LogOut, AlertTriangle, ArrowRight, ShieldCheck,
} from "lucide-react";
import { AuroraBackground } from "@/components/AuroraBackground";
import { store, validateToken, type User } from "@/lib/store";

export const Route = createFileRoute("/scan/$token")({
  head: () => ({
    meta: [
      { title: "Verify · Pulse.QR" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ScanPage,
});

type Stage = "loading" | "invalid" | "register" | "result";

function ScanPage() {
  const { token } = Route.useParams();
  const [stage, setStage] = useState<Stage>("loading");
  const [invalidReason, setInvalidReason] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [existingUser, setExistingUser] = useState<User | null>(null);
  const [result, setResult] = useState<{ action: "in" | "out"; user: User; at: string } | null>(null);

  // Validate on mount
  useEffect(() => {
    const t = setTimeout(() => {
      const v = validateToken(token);
      if (!v.ok) {
        setInvalidReason(
          v.reason === "expired"
            ? "This QR code has expired. Please scan the latest one shown on the device."
            : v.reason === "used"
            ? "This token was already used. Each QR can only be scanned once."
            : "This link is malformed. Please scan a fresh QR from the device.",
        );
        setStage("invalid");
        return;
      }
      setExpiresAt(v.expiresAt);
      setStage("register"); // proceed to identify step
    }, 650);
    return () => clearTimeout(t);
  }, [token]);

  // Countdown
  useEffect(() => {
    if (!expiresAt || stage !== "register") return;
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) {
        setInvalidReason("This QR code expired before you could submit. Please scan a fresh one.");
        setStage("invalid");
      }
    }, 250);
    return () => clearInterval(tick);
  }, [expiresAt, stage]);

  const handleIdentified = (user: User) => {
    // Re-validate at submit time
    const v = validateToken(token);
    if (!v.ok) {
      setInvalidReason(
        v.reason === "expired"
          ? "Token expired during submission. Please scan again."
          : v.reason === "used"
          ? "This token was just used. Please scan a fresh QR."
          : "Invalid token.",
      );
      setStage("invalid");
      return;
    }
    const { action, log } = store.toggleAttendance(user, token);
    store.markTokenUsed(token);
    setResult({ action, user, at: action === "in" ? log.check_in_time : (log.check_out_time as string) });
    setStage("result");
    toast.success(action === "in" ? "Checked in" : "Checked out", {
      description: user.full_name,
    });
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <AuroraBackground />
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-10">
        <Link to="/" className="mb-6 text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground">
          ← Pulse.QR
        </Link>

        <AnimatePresence mode="wait">
          {stage === "loading" && <LoadingCard key="l" />}
          {stage === "invalid" && <InvalidCard key="i" reason={invalidReason} />}
          {stage === "register" && expiresAt && (
            <IdentifyCard
              key="r"
              secondsLeft={secondsLeft}
              existingUser={existingUser}
              setExistingUser={setExistingUser}
              onComplete={handleIdentified}
            />
          )}
          {stage === "result" && result && <ResultCard key="res" {...result} />}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---- subcomponents ----

function CardShell({ children, glow = "cyan" }: { children: React.ReactNode; glow?: "cyan" | "magenta" | "green" | "red" }) {
  const colour =
    glow === "magenta" ? "var(--neon-magenta)" :
    glow === "green" ? "var(--success)" :
    glow === "red" ? "var(--destructive)" :
    "var(--neon-cyan)";
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.35 }}
      className="glass-strong relative w-full overflow-hidden rounded-3xl p-8"
      style={{ boxShadow: `0 0 60px ${colour}33, 0 30px 80px -20px rgba(0,0,0,0.6)` }}
    >
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${colour}, transparent)` }} />
      {children}
    </motion.div>
  );
}

function LoadingCard() {
  return (
    <CardShell>
      <div className="flex flex-col items-center text-center">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-[var(--neon-cyan)] opacity-20" />
          <Loader2 className="h-10 w-10 animate-spin text-[var(--neon-cyan)]" />
        </div>
        <h2 className="mt-6 font-display text-xl font-semibold">Verifying token…</h2>
        <p className="mt-2 text-sm text-muted-foreground">Checking freshness, single-use & device signature.</p>
      </div>
    </CardShell>
  );
}

function InvalidCard({ reason }: { reason: string }) {
  return (
    <CardShell glow="red">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15 ring-1 ring-destructive/40">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="mt-6 font-display text-2xl font-semibold">Scan failed</h2>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">{reason}</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-foreground hover:bg-white/10"
        >
          Back to home <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </CardShell>
  );
}

function IdentifyCard({
  secondsLeft,
  existingUser,
  setExistingUser,
  onComplete,
}: {
  secondsLeft: number;
  existingUser: User | null;
  setExistingUser: (u: User | null) => void;
  onComplete: (u: User) => void;
}) {
  const [reg, setReg] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const pct = useMemo(() => (secondsLeft / 15) * 100, [secondsLeft]);

  const handleRegBlur = () => {
    if (!reg.trim()) return;
    const u = store.findUserByReg(reg.trim());
    setExistingUser(u ?? null);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!reg.trim()) e.reg = "Registration number required";
    else if (reg.length > 32) e.reg = "Too long";
    if (!existingUser) {
      if (!name.trim() || name.length < 2) e.name = "Enter your full name";
      else if (name.length > 80) e.name = "Too long";
      if (!/^\d{10}$/.test(mobile.trim())) e.mobile = "Enter a 10-digit mobile number";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    const user = existingUser ?? store.createUser({
      full_name: name.trim(),
      registration_no: reg.trim(),
      mobile_no: mobile.trim(),
    });
    onComplete(user);
  };

  return (
    <CardShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--neon-cyan)]">verified</div>
          <h2 className="mt-1 font-display text-2xl font-semibold">
            {existingUser ? `Welcome back, ${existingUser.full_name.split(" ")[0]}` : "Identify yourself"}
          </h2>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-1 font-mono text-xl font-bold text-gradient tabular-nums">
            <Clock className="h-4 w-4 text-[var(--neon-cyan)]" />
            {String(secondsLeft).padStart(2, "0")}s
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">expires</div>
        </div>
      </div>

      <div className="mb-6 h-1 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="h-full rounded-full bg-[var(--gradient-neon)]"
          animate={{ width: `${pct}%` }}
          transition={{ ease: "linear", duration: 0.25 }}
        />
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Field
          label="Registration number"
          placeholder="e.g. CS2024001"
          value={reg}
          onChange={(v) => setReg(v.toUpperCase())}
          onBlur={handleRegBlur}
          error={errors.reg}
          autoFocus
          maxLength={32}
        />

        <AnimatePresence>
          {existingUser ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-3 rounded-xl border border-[var(--neon-cyan)]/20 bg-[var(--neon-cyan)]/5 p-3 text-sm"
            >
              <ShieldCheck className="h-5 w-5 text-[var(--neon-cyan)]" />
              <div>
                <div className="font-medium text-foreground">{existingUser.full_name}</div>
                <div className="text-xs text-muted-foreground">Recognised · skipping registration</div>
              </div>
            </motion.div>
          ) : reg ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              <Field label="Full name" placeholder="Ada Lovelace" value={name} onChange={setName} error={errors.name} maxLength={80} />
              <Field label="Mobile number" placeholder="10 digits" value={mobile} onChange={(v) => setMobile(v.replace(/\D/g, "").slice(0, 10))} error={errors.mobile} inputMode="numeric" />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <button
          type="submit"
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--gradient-neon)] px-5 py-3.5 text-sm font-semibold text-background shadow-[var(--shadow-glow-cyan)] transition hover:opacity-95 active:scale-[0.99]"
        >
          Mark attendance <ArrowRight className="h-4 w-4" />
        </button>
        <p className="text-center text-[11px] text-muted-foreground">
          We'll auto-detect whether to check you <span className="text-foreground">in</span> or <span className="text-foreground">out</span>.
        </p>
      </form>
    </CardShell>
  );
}

function Field({
  label, value, onChange, error, ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-widest text-muted-foreground">{label}</span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border bg-white/[0.04] px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-[var(--neon-cyan)]/50 focus:bg-white/[0.07] focus:ring-2 focus:ring-[var(--neon-cyan)]/20 ${error ? "border-destructive/50" : "border-white/10"}`}
      />
      {error && <span className="mt-1 block text-xs text-destructive">{error}</span>}
    </label>
  );
}

function ResultCard({ action, user, at }: { action: "in" | "out"; user: User; at: string }) {
  const isIn = action === "in";
  const time = new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date = new Date(at).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });

  return (
    <CardShell glow={isIn ? "green" : "magenta"}>
      <div className="flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 14 }}
          className="relative flex h-24 w-24 items-center justify-center rounded-full"
          style={{
            background: isIn
              ? "radial-gradient(circle, var(--success) 0%, transparent 70%)"
              : "radial-gradient(circle, var(--neon-magenta) 0%, transparent 70%)",
          }}
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-background/40 ring-1 ring-white/20 backdrop-blur">
            {isIn
              ? <CheckCircle2 className="h-10 w-10 text-[var(--success)]" />
              : <XCircle className="h-10 w-10 text-[var(--neon-magenta)]" />}
          </div>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="mt-6 font-display text-3xl font-bold"
        >
          {isIn ? "Checked In" : "Checked Out"}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
          className="mt-1 text-sm text-muted-foreground"
        >
          {isIn ? "Welcome to the session." : "See you next time."}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="mt-6 w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left"
        >
          <Row label="Name" value={user.full_name} />
          <Row label="Reg. No." value={user.registration_no} mono />
          <Row label="Action" value={isIn ? "Check-in" : "Check-out"} icon={isIn ? <LogIn className="h-3.5 w-3.5 text-[var(--success)]" /> : <LogOut className="h-3.5 w-3.5 text-[var(--neon-magenta)]" />} />
          <Row label="Date" value={date} />
          <Row label="Time" value={time} mono />
        </motion.div>

        <Link to="/" className="mt-6 text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground">
          ← back to home
        </Link>
      </div>
    </CardShell>
  );
}

function Row({ label, value, mono, icon }: { label: string; value: string; mono?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-2 last:border-0">
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className={`flex items-center gap-1.5 text-sm text-foreground ${mono ? "font-mono" : ""}`}>
        {icon}{value}
      </span>
    </div>
  );
}
