"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

/** 一个定位点：坐标 + 城市名 + 时间戳 */
export interface GeoPoint {
  lat: number;
  lng: number;
  city: string;
  ts: number;
}

export type LocSource = "manual" | "browser";

/** 最佳已知位置（用于发帖/对话携带） */
export interface BestLocation {
  lat: number;
  lng: number;
  city: string;
  source: LocSource;
}

interface StoredLocation {
  /** 手动设置的城巿（优先级最高） */
  manual: GeoPoint | null;
  /** 设备定位（最近一次成功） */
  browser: GeoPoint | null;
}

interface LocationState {
  manual: GeoPoint | null;
  browser: GeoPoint | null;
  /** 设备精确定位：成功写入 browser 并覆盖 manual */
  requestDeviceLocation: () => Promise<{ ok: boolean; error?: string }>;
  /** 手动设置城市（优先级最高） */
  setManualCity: (name: string) => Promise<{ ok: boolean; error?: string }>;
  /** 清除所有保存的位置 */
  clear: () => void;
  /** 最佳已知位置：手动 > 设备 */
  getBest: () => BestLocation | null;
  /** 按钮文案：📍城市 或 定位 */
  label: string;
  hasLocation: boolean;
}

const STORAGE_KEY = "aihub_location";
const LocationContext = createContext<LocationState | undefined>(undefined);

// 反向地理编码取城市名（免 key）
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const r = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=zh`
    );
    const d = await r.json();
    return d.city || d.locality || d.principalSubdivision || "";
  } catch {
    return "";
  }
}

function load(): StoredLocation {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { manual: p.manual ?? null, browser: p.browser ?? null };
    }
  } catch {
    /* ignore */
  }
  return { manual: null, browser: null };
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<StoredLocation>({ manual: null, browser: null });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setStored(load());
    setReady(true);
  }, []);

  const update = useCallback((updater: (prev: StoredLocation) => StoredLocation) => {
    setStored((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const requestDeviceLocation = useCallback(async () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      return { ok: false, error: "当前浏览器不支持设备定位" };
    }
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const city = await reverseGeocode(lat, lng);
      const point: GeoPoint = { lat, lng, city, ts: Date.now() };
      update(() => ({ manual: null, browser: point })); // 设备定位成功则覆盖手动城市
      return { ok: true };
    } catch (err: unknown) {
      const code = (err as GeolocationPositionError)?.code;
      let msg = "设备定位失败";
      if (code === 1) msg = "设备定位被拒绝，可在浏览器设置中允许，或直接输入城市名";
      else if (code === 2) msg = "当前无法获取设备位置";
      else if (code === 3) msg = "设备定位超时";
      return { ok: false, error: msg };
    }
  }, [update]);

  const setManualCity = useCallback(
    async (name: string) => {
      const city = name.trim();
      if (!city) return { ok: false, error: "请输入城市名" };
      try {
        const r = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&language=zh&count=1`
        );
        const d = await r.json();
        const loc = d.results && d.results[0];
        if (!loc) return { ok: false, error: `未找到城市「${city}」，请检查名称` };
        const point: GeoPoint = {
          lat: loc.latitude,
          lng: loc.longitude,
          city: loc.name,
          ts: Date.now(),
        };
        update((prev) => ({ manual: point, browser: prev.browser }));
        return { ok: true };
      } catch {
        return { ok: false, error: "城市查询失败，请稍后再试" };
      }
    },
    [update]
  );

  const clear = useCallback(() => {
    update(() => ({ manual: null, browser: null }));
  }, [update]);

  const getBest = useCallback((): BestLocation | null => {
    if (stored.manual) return { ...stored.manual, source: "manual" };
    if (stored.browser) return { ...stored.browser, source: "browser" };
    return null;
  }, [stored]);

  const best = getBest();
  const label = best ? (best.city ? `📍${best.city}` : "📍已定位") : "定位";
  const hasLocation = !!best;

  if (!ready) return null;

  return (
    <LocationContext.Provider
      value={{
        manual: stored.manual,
        browser: stored.browser,
        requestDeviceLocation,
        setManualCity,
        clear,
        getBest,
        label,
        hasLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (ctx === undefined) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return ctx;
}
