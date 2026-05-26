import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ScanLine, ShieldCheck, Activity, Clock, ArrowRight, Cpu, QrCode, Users } from "lucide-react";
import { AuroraBackground } from "@/components/AuroraBackground";
import { SiteHeader } from "@/components/SiteHeader";
import { LiveQrCard } from "@/components/LiveQrCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pulse.QR — Dynamic QR Attendance for Events & Classrooms" },
      { name: "description", content: "Premium attendance check-in with rotating QR codes on ESP32. Built for hackathons, conferences and classrooms." },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="relative min-h-screen">
      <AuroraBackground />
      <SiteHeader />

      {/* HERO */}
      <section className="relative mx-auto max-w-6xl px-4 pt-16 pb-12 sm:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium tracking-wider text-muted-foreground"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--neon-cyan)] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--neon-cyan)]" />
              </span>
              ESP32 · LIVE
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
            >
              Check-in at the
              <br />
              <span className="text-gradient">speed of light.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              A rotating QR code on a tiny TFT display, a phone, and a single tap. Pulse.QR turns
              any event, classroom or hackathon door into a frictionless, fraud-resistant attendance
              system.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <a
                href="#demo-qr"
                className="group inline-flex items-center gap-2 rounded-xl bg-[var(--gradient-neon)] px-5 py-3 text-sm font-semibold text-background shadow-[var(--shadow-glow-cyan)] transition hover:opacity-95"
              >
                <ScanLine className="h-4 w-4" />
                Scan a live QR
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </a>
              <Link
                to="/admin"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-foreground transition hover:bg-white/[0.07]"
              >
                Open admin dashboard
              </Link>
            </motion.div>

            <motion.dl
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mt-12 grid max-w-lg grid-cols-3 gap-4"
            >
              {[
                { k: "15s", v: "QR rotation" },
                { k: "<1s", v: "Check-in latency" },
                { k: "0", v: "Reusable tokens" },
              ].map((s) => (
                <div key={s.v} className="glass rounded-xl p-3 text-center">
                  <div className="font-mono text-2xl font-bold text-gradient">{s.k}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">{s.v}</div>
                </div>
              ))}
            </motion.dl>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <LiveQrCard />
          </motion.div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="mb-12 max-w-2xl">
          <div className="text-xs uppercase tracking-[0.25em] text-[var(--neon-cyan)]">protocol</div>
          <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
            A four-step check-in, engineered for trust.
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Cpu, title: "ESP32 emits", body: "TFT screen rotates a signed, single-use token every 15 seconds." },
            { icon: QrCode, title: "User scans", body: "Phone opens /scan/[token]. We validate freshness and uniqueness." },
            { icon: Users, title: "Identify", body: "First scan registers the user. Returning users skip the form." },
            { icon: Activity, title: "Toggle status", body: "Auto check-in or check-out, streamed live to the dashboard." },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="glass group relative overflow-hidden rounded-2xl p-5 transition hover:bg-white/[0.06]"
            >
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[var(--neon-cyan)] opacity-0 blur-2xl transition group-hover:opacity-15" />
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
                <f.icon className="h-5 w-5 text-[var(--neon-cyan)]" />
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
                <h3 className="font-display text-lg font-semibold">{f.title}</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { icon: ShieldCheck, title: "Tamper-resistant", body: "Every token is single-use and expires in 15 seconds. Screenshots become worthless." },
            { icon: Clock, title: "Live timeline", body: "A real-time activity feed shows every check-in and check-out as it happens." },
            { icon: Activity, title: "Beautiful analytics", body: "Daily counts, currently-present, CSV export — built for organisers, not spreadsheets." },
          ].map((f) => (
            <div key={f.title} className="glass rounded-2xl p-6">
              <f.icon className="h-5 w-5 text-[var(--neon-magenta)]" />
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-xs text-muted-foreground">
        Pulse.QR · crafted for hackathons, classrooms & conferences
      </footer>
    </div>
  );
}
