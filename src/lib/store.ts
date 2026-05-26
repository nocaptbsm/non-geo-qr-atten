// Frontend-only mock data store. Persists to localStorage.
// Designed so the swap to Lovable Cloud later is mechanical.

export type User = {
  id: string;
  full_name: string;
  registration_no: string;
  mobile_no: string;
  created_at: string;
};

export type AttendanceLog = {
  id: string;
  user_id: string;
  user_name: string;
  registration_no: string;
  check_in_time: string;
  check_out_time: string | null;
  device_id: string;
  token: string;
};

const USERS_KEY = "qr_users";
const LOGS_KEY = "qr_logs";
const USED_TOKENS_KEY = "qr_used_tokens";

const isBrowser = () => typeof window !== "undefined";

function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, value: T) {
  if (!isBrowser()) return;
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("qr-store-change"));
}

export const store = {
  getUsers(): User[] {
    return read<User[]>(USERS_KEY, []);
  },
  getLogs(): AttendanceLog[] {
    return read<AttendanceLog[]>(LOGS_KEY, []);
  },
  findUserByReg(reg: string): User | undefined {
    return store.getUsers().find((u) => u.registration_no.toLowerCase() === reg.toLowerCase());
  },
  createUser(input: Omit<User, "id" | "created_at">): User {
    const users = store.getUsers();
    const user: User = {
      ...input,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    users.push(user);
    write(USERS_KEY, users);
    return user;
  },
  isTokenUsed(token: string): boolean {
    return read<string[]>(USED_TOKENS_KEY, []).includes(token);
  },
  markTokenUsed(token: string) {
    const used = read<string[]>(USED_TOKENS_KEY, []);
    used.push(token);
    write(USED_TOKENS_KEY, used.slice(-200));
  },
  /**
   * Toggle attendance: if the user has an open log (no check_out_time), close it.
   * Otherwise open a new one.
   */
  toggleAttendance(user: User, token: string, deviceId = "ESP32-01"): {
    action: "in" | "out";
    log: AttendanceLog;
  } {
    const logs = store.getLogs();
    const openIdx = logs.findIndex((l) => l.user_id === user.id && !l.check_out_time);
    if (openIdx >= 0) {
      const updated: AttendanceLog = {
        ...logs[openIdx],
        check_out_time: new Date().toISOString(),
      };
      logs[openIdx] = updated;
      write(LOGS_KEY, logs);
      return { action: "out", log: updated };
    }
    const log: AttendanceLog = {
      id: crypto.randomUUID(),
      user_id: user.id,
      user_name: user.full_name,
      registration_no: user.registration_no,
      check_in_time: new Date().toISOString(),
      check_out_time: null,
      device_id: deviceId,
      token,
    };
    logs.push(log);
    write(LOGS_KEY, logs);
    return { action: "in", log };
  },
  reset() {
    if (!isBrowser()) return;
    localStorage.removeItem(USERS_KEY);
    localStorage.removeItem(LOGS_KEY);
    localStorage.removeItem(USED_TOKENS_KEY);
    window.dispatchEvent(new CustomEvent("qr-store-change"));
  },
  seedDemo() {
    if (store.getUsers().length > 0) return;
    const demo: User[] = [
      { id: crypto.randomUUID(), full_name: "Ava Chen", registration_no: "CS2024001", mobile_no: "9876543210", created_at: new Date(Date.now() - 86400000).toISOString() },
      { id: crypto.randomUUID(), full_name: "Liam Patel", registration_no: "CS2024002", mobile_no: "9876543211", created_at: new Date(Date.now() - 86000000).toISOString() },
      { id: crypto.randomUUID(), full_name: "Noah Garcia", registration_no: "EC2024014", mobile_no: "9876543212", created_at: new Date(Date.now() - 80000000).toISOString() },
    ];
    write(USERS_KEY, demo);
    const logs: AttendanceLog[] = demo.map((u, i) => ({
      id: crypto.randomUUID(),
      user_id: u.id,
      user_name: u.full_name,
      registration_no: u.registration_no,
      check_in_time: new Date(Date.now() - (3600_000 * (i + 1))).toISOString(),
      check_out_time: i === 0 ? null : new Date(Date.now() - (1800_000 * (i + 1))).toISOString(),
      device_id: "ESP32-01",
      token: "seed-" + u.id.slice(0, 8),
    }));
    write(LOGS_KEY, logs);
  },
};

// ----- Token system (frontend-only) -----
// Token format: t_<base36_expiryMs>_<random6>
// Simple, simulates ESP32 rotating QR. Expires in 15s.

const TOKEN_TTL_MS = 15_000;

export function generateToken(): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const rand = Math.random().toString(36).slice(2, 8);
  return `t_${exp.toString(36)}_${rand}`;
}

export type TokenValidation =
  | { ok: true; expiresAt: number }
  | { ok: false; reason: "malformed" | "expired" | "used" };

export function validateToken(token: string): TokenValidation {
  const parts = token.split("_");
  if (parts.length !== 3 || parts[0] !== "t") return { ok: false, reason: "malformed" };
  const exp = parseInt(parts[1], 36);
  if (!exp || Number.isNaN(exp)) return { ok: false, reason: "malformed" };
  if (Date.now() > exp) return { ok: false, reason: "expired" };
  if (store.isTokenUsed(token)) return { ok: false, reason: "used" };
  return { ok: true, expiresAt: exp };
}
