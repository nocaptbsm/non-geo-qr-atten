import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import { Wifi, RefreshCw } from "lucide-react";
import { generateToken } from "@/lib/store";

const TTL = 15;

export function LiveQrCard() {
  const [token, setToken] = useState(() => generateToken());
  const [secondsLeft, setSecondsLeft] = useState(TTL);

  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setToken(generateToken());
          return TTL;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const url = useMemo(
    () => `${typeof window !== "undefined" ? window.location.origin : ""}/scan/${token}`,
    [token],
  );

  const pct = (secondsLeft / TTL) * 100;

  return (
    <div id="demo-qr" className="glass-strong relative overflow-hidden rounded-3xl p-6 sm:p-8">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--neon-cyan)] to-transparent opacity-70" />
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <Wifi className="h-3.5 w-3.5 text-[var(--neon-cyan)]" />
            ESP32 · TFT live feed
          </div>
          <h3 className="mt-2 font-display text-lg font-semibold">Dynamic check-in code</h3>
        </div>
        <div className="text-right">
          <div className="font-mono text-3xl font-bold text-gradient tabular-nums">
            {String(secondsLeft).padStart(2, "0")}s
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">rotates</div>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center">
        <div className="relative rounded-2xl bg-white p-4 shadow-[var(--shadow-glow-cyan)] animate-pulse-glow">
          <AnimatePresence mode="wait">
            <motion.div
              key={token}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.25 }}
            >
              <QRCodeSVG value={url} size={208} bgColor="#ffffff" fgColor="#0c1118" level="M" />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-5 w-full">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <motion.div
              className="h-full rounded-full bg-[var(--gradient-neon)]"
              animate={{ width: `${pct}%` }}
              transition={{ ease: "linear", duration: 0.9 }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
            <span className="truncate pr-2">{token}</span>
            <button
              onClick={() => {
                setToken(generateToken());
                setSecondsLeft(TTL);
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-foreground/80 hover:bg-white/5"
            >
              <RefreshCw className="h-3 w-3" /> rotate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
