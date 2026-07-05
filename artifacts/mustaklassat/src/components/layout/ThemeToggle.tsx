import { useEffect, useState } from "react";

/**
 * ThemeToggle — تبديل مظهر البرنامج بشكل قابل للرجوع
 * الأوضاع: 'classic' (الافتراضي، بدون تغيير) | 'dark' (الوضع الداكن)
 * الاختيار محفوظ في localStorage — لو الجديد وحش يرجع كلاسيكي بضغطة.
 * لا يحذف أي شيء من التصميم القديم؛ يضيف/يزيل class فقط.
 */

const KEY = "mn_ui_theme";
type Mode = "classic" | "dark";

function readMode(): Mode {
  try {
    const v = localStorage.getItem(KEY);
    return v === "dark" ? "dark" : "classic";
  } catch {
    return "classic";
  }
}

export function applyThemeEarly() {
  // يُستدعى مبكراً لتفادي وميض التبديل
  const m = readMode();
  const el = document.documentElement;
  if (m === "dark") el.classList.add("dark");
  else el.classList.remove("dark");
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>(readMode);

  useEffect(() => {
    const el = document.documentElement;
    if (mode === "dark") el.classList.add("dark");
    else el.classList.remove("dark");
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  const isDark = mode === "dark";

  return (
    <button
      type="button"
      onClick={() => setMode(isDark ? "classic" : "dark")}
      title={isDark ? "الرجوع للمظهر الكلاسيكي" : "تفعيل الوضع الداكن"}
      className="inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-xs font-bold transition-all hover:-translate-y-0.5"
      style={{
        background: isDark ? "rgba(212,175,55,0.15)" : "rgba(30,60,114,0.08)",
        border: isDark
          ? "1px solid rgba(212,175,55,0.4)"
          : "1px solid rgba(30,60,114,0.15)",
        color: isDark ? "#d4af37" : "#1e3c72",
      }}
    >
      <span aria-hidden>{isDark ? "🌙" : "🏛️"}</span>
      {isDark ? "داكن" : "كلاسيكي"}
    </button>
  );
}
