import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { PauseCircle, PlayCircle, Radio, Volume2 } from "lucide-react";

const RADIO_API = "https://mp3quran.net/api/v3/radios?language=ar";
const PLAYING_KEY = "najran_quran_radio_playing";
const VOLUME_KEY = "najran_quran_radio_volume";
const RADIO_URL_KEY = "najran_quran_radio_egypt_url";
const RADIO_NAME_KEY = "najran_quran_radio_egypt_name";
const POSITION_KEY = "najran_quran_radio_position";
const DEFAULT_VOLUME = 0.65;
const DEFAULT_RADIO: RadioInfo = {
  name: "إذاعة القرآن الكريم من القاهرة",
  url: "https://stream.radiojar.com/8s5u5tpdtwzuv",
  source: "fallback",
};
const BACKUP_RADIOS: RadioInfo[] = [
  DEFAULT_RADIO,
  { name: "إذاعة القرآن الكريم", url: "https://server03.quran.com.kw:7002/;", source: "fallback" },
];

type RadioInfo = { name: string; url: string; source: "egypt" | "fallback" };
type Position = { left: number; top: number };

declare global {
  interface Window {
    __NAJRAN_QURAN_RADIO_AUDIO__?: HTMLAudioElement;
    __NAJRAN_QURAN_RADIO_INFO__?: RadioInfo;
  }
}

function normalizeArabic(value: string) {
  return String(value || "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .toLowerCase();
}

function readInitialVolume() {
  const raw = Number(localStorage.getItem(VOLUME_KEY));
  if (Number.isFinite(raw) && raw >= 0 && raw <= 1) return raw;
  return DEFAULT_VOLUME;
}

function clampPosition(pos: Position, width = 330, height = 72): Position {
  const maxLeft = Math.max(8, window.innerWidth - width - 8);
  const maxTop = Math.max(8, window.innerHeight - height - 8);
  return {
    left: Math.min(Math.max(8, pos.left), maxLeft),
    top: Math.min(Math.max(8, pos.top), maxTop),
  };
}

function readInitialPosition(): Position {
  try {
    const parsed = JSON.parse(localStorage.getItem(POSITION_KEY) || "null");
    if (parsed && Number.isFinite(parsed.left) && Number.isFinite(parsed.top)) return clampPosition(parsed);
  } catch {}
  return { left: 16, top: Math.max(90, window.innerHeight - 100) };
}

function getAudio() {
  if (!window.__NAJRAN_QURAN_RADIO_AUDIO__) {
    const audio = new Audio();
    audio.preload = "none";
    audio.volume = readInitialVolume();
    window.__NAJRAN_QURAN_RADIO_AUDIO__ = audio;
  }
  return window.__NAJRAN_QURAN_RADIO_AUDIO__;
}

function getCachedRadio(): RadioInfo {
  const url = localStorage.getItem(RADIO_URL_KEY) || "";
  const name = localStorage.getItem(RADIO_NAME_KEY) || "إذاعة القرآن الكريم من القاهرة";
  if (url) return { name, url, source: "egypt" };
  return DEFAULT_RADIO;
}

function pickEgyptRadio(radios: any[]): RadioInfo | null {
  const candidates = radios
    .map((r) => ({
      name: String(r?.name || r?.title || ""),
      url: String(r?.url || r?.radio_url || r?.stream_url || ""),
      normalized: normalizeArabic(String(r?.name || r?.title || "")),
    }))
    .filter((r) => r.url && /^https?:\/\//i.test(r.url));

  const egypt = candidates.find((r) =>
    (r.normalized.includes("القاهره") || r.normalized.includes("مصر") || r.normalized.includes("egypt") || r.normalized.includes("cairo")) &&
    (r.normalized.includes("قران") || r.normalized.includes("quran"))
  );
  if (egypt) return { name: egypt.name || "إذاعة القرآن الكريم من القاهرة", url: egypt.url, source: "egypt" };

  return null;
}

export function QuranRadioFloatingPlayer() {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const backupIndexRef = useRef(0);
  const [radio, setRadio] = useState<RadioInfo>(() => getCachedRadio());
  const [volume, setVolume] = useState(() => readInitialVolume());
  const [position, setPosition] = useState<Position>(() => readInitialPosition());
  const [isPlaying, setIsPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const wantsPlaying = useMemo(() => localStorage.getItem(PLAYING_KEY) === "true", []);

  useEffect(() => {
    const audio = getAudio();
    audioRef.current = audio;
    audio.volume = volume;
    const onPlay = () => { setIsPlaying(true); setBlocked(false); setStreamError(false); };
    const onPause = () => setIsPlaying(false);
    const onError = () => {
      setIsPlaying(false);
      setStreamError(true);
      const next = BACKUP_RADIOS[backupIndexRef.current % BACKUP_RADIOS.length];
      backupIndexRef.current += 1;
      if (next?.url && next.url !== audio.src) {
        setRadio(next);
        audio.src = next.url;
      }
    };
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);
    setIsPlaying(!audio.paused);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
    };
  }, [volume]);

  useEffect(() => {
    let cancelled = false;
    fetch(RADIO_API)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const selected = pickEgyptRadio(Array.isArray(data?.radios) ? data.radios : []);
        if (!selected?.url) return;
        localStorage.setItem(RADIO_URL_KEY, selected.url);
        localStorage.setItem(RADIO_NAME_KEY, selected.name);
        window.__NAJRAN_QURAN_RADIO_INFO__ = selected;
        setRadio(selected);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const audio = getAudio();
    if (!radio.url) return;
    if (audio.src !== radio.url) audio.src = radio.url;
    audio.volume = volume;
    if (wantsPlaying) {
      window.setTimeout(() => {
        audio.play().catch(() => {
          setBlocked(true);
          setIsPlaying(false);
        });
      }, 250);
    }
  }, [radio.url, volume, wantsPlaying]);

  useEffect(() => {
    const onResize = () => setPosition((p) => clampPosition(p, expanded ? 330 : 58, expanded ? 96 : 58));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [expanded]);

  const play = () => {
    const audio = getAudio();
    const src = radio.url || DEFAULT_RADIO.url;
    if (audio.src !== src) audio.src = src;
    localStorage.setItem(PLAYING_KEY, "true");
    audio.load();
    audio.play()
      .then(() => { setIsPlaying(true); setBlocked(false); setStreamError(false); })
      .catch((err) => {
        console.warn("[QuranRadio] playback blocked or failed", err);
        setBlocked(true);
        setIsPlaying(false);
      });
  };

  const pause = () => {
    const audio = getAudio();
    localStorage.setItem(PLAYING_KEY, "false");
    audio.pause();
    setIsPlaying(false);
  };

  const updateVolume = (next: number) => {
    const v = Math.max(0, Math.min(1, next));
    setVolume(v);
    localStorage.setItem(VOLUME_KEY, String(v));
    getAudio().volume = v;
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    dragRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, left: position.left, top: position.top, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    const next = clampPosition({ left: d.left + dx, top: d.top + dy }, expanded ? 330 : 58, expanded ? 96 : 58);
    setPosition(next);
  };

  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const moved = d.moved;
    dragRef.current = null;
    localStorage.setItem(POSITION_KEY, JSON.stringify(position));
    if (!moved) setExpanded((v) => !v);
  };

  return (
    <div
      ref={boxRef}
      dir="rtl"
      className="fixed z-[2147483000] rounded-2xl shadow-2xl overflow-hidden print:hidden select-none"
      style={{ left: position.left, top: position.top, width: expanded ? 330 : 58, background: "linear-gradient(135deg,#0f2050,#1e3c72)", border: "1px solid rgba(212,175,55,.35)", touchAction: "none" }}
    >
      <div style={{ height: 3, background: "linear-gradient(90deg,#d4af37,#f0d060,#d4af37)" }} />
      <div className="p-2 flex items-center gap-2">
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 cursor-move"
          style={{ background: "rgba(212,175,55,.18)", color: "#d4af37", border: "1px solid rgba(212,175,55,.28)" }}
          title="اسحب لتغيير المكان — اضغط للفتح"
        >
          <Radio className="h-5 w-5" />
        </button>

        {expanded && (
          <>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-white text-xs font-black truncate">إذاعة القرآن الكريم — مصر</p>
                <span className="text-[10px] font-black rounded-full px-2 py-0.5" style={{ color: isPlaying ? "#4ade80" : "#d4af37", background: isPlaying ? "rgba(34,197,94,.16)" : "rgba(212,175,55,.15)" }}>{isPlaying ? "مباشر" : "اضغط تشغيل"}</span>
              </div>
              <p className="text-[10px] truncate mt-0.5" style={{ color: "rgba(255,255,255,.58)" }}>{radio.name}</p>
              {(blocked || streamError) && <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,.55)" }}>الصوت يحتاج ضغطة تشغيل، ولو لم يعمل سيجرب مصدرًا احتياطيًا.</p>}
              <div className="flex items-center gap-2 mt-2">
                <Volume2 className="h-3.5 w-3.5" style={{ color: "#d4af37" }} />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(volume * 100)}
                  onChange={(e) => updateVolume(Number(e.target.value) / 100)}
                  className="w-full accent-yellow-600"
                  aria-label="مستوى صوت إذاعة القرآن الكريم"
                />
                <span className="text-[10px] w-8 text-left" style={{ color: "rgba(255,255,255,.62)" }}>{Math.round(volume * 100)}%</span>
              </div>
            </div>
            <button
              type="button"
              onClick={isPlaying ? pause : play}
              className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#d4af37,#b8962e)", color: "#0f2050", border: 0 }}
              title={isPlaying ? "إيقاف" : "تشغيل"}
            >
              {isPlaying ? <PauseCircle className="h-5 w-5" /> : <PlayCircle className="h-5 w-5" />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
