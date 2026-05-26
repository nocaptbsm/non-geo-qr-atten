import { Link } from "@tanstack/react-router";
import { ScanLine, LayoutDashboard, Zap } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40">
      <div className="mx-auto mt-4 max-w-6xl px-4">
        <div className="glass flex items-center justify-between rounded-2xl px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--gradient-neon)]">
              <Zap className="h-4 w-4 text-background" />
            </span>
            <span className="font-display text-sm font-semibold tracking-widest text-foreground">
              PULSE<span className="text-gradient">.QR</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              to="/"
              activeOptions={{ exact: true }}
              activeProps={{ className: "text-foreground bg-white/5" }}
              className="rounded-lg px-3 py-1.5 text-muted-foreground transition hover:text-foreground hover:bg-white/5"
            >
              Home
            </Link>
            <Link
              to="/admin"
              activeProps={{ className: "text-foreground bg-white/5" }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-muted-foreground transition hover:text-foreground hover:bg-white/5"
            >
              <LayoutDashboard className="h-3.5 w-3.5" /> Admin
            </Link>
            <a
              href="#demo-qr"
              className="ml-2 hidden items-center gap-1.5 rounded-lg bg-[var(--gradient-neon)] px-3 py-1.5 text-xs font-semibold text-background shadow-[var(--shadow-glow-cyan)] transition hover:opacity-90 sm:flex"
            >
              <ScanLine className="h-3.5 w-3.5" /> Live QR
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}
