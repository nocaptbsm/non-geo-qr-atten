export function AuroraBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute -top-40 -left-32 h-[480px] w-[480px] rounded-full bg-[var(--neon-cyan)] opacity-20 blur-[120px] animate-float-orb" />
      <div className="absolute top-1/3 -right-32 h-[520px] w-[520px] rounded-full bg-[var(--neon-magenta)] opacity-15 blur-[140px] animate-float-orb" style={{ animationDelay: "-4s" }} />
      <div className="absolute bottom-0 left-1/3 h-[420px] w-[420px] rounded-full bg-[var(--neon-violet)] opacity-15 blur-[120px] animate-float-orb" style={{ animationDelay: "-8s" }} />
    </div>
  );
}
