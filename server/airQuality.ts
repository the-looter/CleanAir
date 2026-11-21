export interface AqiCategoryInfo {
  label: string;
  severity: "good" | "moderate" | "unhealthy" | "severe";
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface OpenMeteoGeocodingResult {
  id: number;
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}

interface OpenMeteoAirQualityResponse {
  timezone: string;
  current: {
    time: string;
    us_aqi: number;
    european_aqi: number;
    pm2_5: number;
    pm10: number;
    nitrogen_dioxide: number;
    ozone: number;
    sulphur_dioxide: number;
    carbon_monoxide: number;
  };
  hourly: {
    time: string[];
    us_aqi: (number | null)[];
    pm2_5: (number | null)[];
    pm10: (number | null)[];
    nitrogen_dioxide: (number | null)[];
    ozone: (number | null)[];
  };
}

interface OpenMeteoWeatherResponse {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
  };
  hourly?: {
    wind_speed_10m?: (number | null)[];
  };
}

interface HourlyForecastPoint {
  time: string;
  usAqi: number;
  pm25: number;
  pm10: number;
  no2: number;
  o3: number;
  windSpeed: number;
}

const AQ_TTL_MS = 5 * 60 * 1000;
const GEO_TTL_MS = 30 * 60 * 1000;
const MAX_CACHE_ENTRIES = 120;

const aqCache = new Map<string, CacheEntry<unknown>>();
const aqInflight = new Map<string, Promise<unknown>>();
const geoCache = new Map<string, CacheEntry<unknown>>();

export function setBoundedCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  data: T,
  ttlMs: number
): void {
  const now = Date.now();
  if (cache.size >= MAX_CACHE_ENTRIES) {
    for (const [k, v] of cache.entries()) {
      if (v.expiresAt <= now) cache.delete(k);
    }
    if (cache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) cache.delete(oldestKey);
    }
  }
  cache.set(key, { data, expiresAt: now + ttlMs });
}

export function getAqiCategory(aqi: number): AqiCategoryInfo {
  if (aqi <= 50) return { label: "Good", severity: "good" };
  if (aqi <= 100) return { label: "Moderate", severity: "moderate" };
  if (aqi <= 150) return { label: "Unhealthy for Sensitive Groups", severity: "unhealthy" };
  if (aqi <= 200) return { label: "Unhealthy", severity: "unhealthy" };
  if (aqi <= 300) return { label: "Very Unhealthy", severity: "severe" };
  return { label: "Hazardous", severity: "severe" };
}

export async function searchCityLocations(query: string) {
  const cacheKey = query.toLowerCase();
  const cached = geoCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    query
  )}&count=6&language=en&format=json`;
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) {
    throw new Error(`Geocoding service returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as { results?: OpenMeteoGeocodingResult[] };
  const results = (data.results || []).map((r) => ({
    id: String(r.id),
    name: r.name,
    region: [r.admin1, r.country].filter(Boolean).join(", "),
    country: r.country,
    lat: r.latitude,
    lon: r.longitude,
    timezone: r.timezone || "auto",
  }));

  const payload = { results };
  setBoundedCache(geoCache, cacheKey, payload, GEO_TTL_MS);
  return payload;
}

function buildHourlyForecast(
  aq: OpenMeteoAirQualityResponse,
  wxHourlyWind: (number | null)[],
  fallbackWind: number,
  nowIdx: number
): HourlyForecastPoint[] {
  const times = aq.hourly.time || [];
  const forecast: HourlyForecastPoint[] = [];
  for (let i = nowIdx; i < Math.min(times.length, nowIdx + 48); i++) {
    forecast.push({
      time: times[i],
      usAqi: Math.round(aq.hourly.us_aqi[i] ?? aq.current.us_aqi ?? 0),
      pm25: Number((aq.hourly.pm2_5[i] ?? aq.current.pm2_5 ?? 0).toFixed(1)),
      pm10: Number((aq.hourly.pm10[i] ?? aq.current.pm10 ?? 0).toFixed(1)),
      no2: Number((aq.hourly.nitrogen_dioxide[i] ?? aq.current.nitrogen_dioxide ?? 0).toFixed(1)),
      o3: Number((aq.hourly.ozone[i] ?? aq.current.ozone ?? 0).toFixed(1)),
      windSpeed: Number((wxHourlyWind[i] ?? fallbackWind).toFixed(1)),
    });
  }
  return forecast;
}

function findBestVentilationWindow(
  next24: HourlyForecastPoint[],
  fallbackTime: string
): { startTime: string; endTime: string; expectedPm25: number } {
  let bestStartIdx = 0;
  let lowestAvgPm25 = Infinity;
  for (let i = 0; i < Math.max(1, next24.length - 1); i++) {
    const pairAvg = (next24[i].pm25 + (next24[i + 1]?.pm25 ?? next24[i].pm25)) / 2;
    if (pairAvg < lowestAvgPm25) {
      lowestAvgPm25 = pairAvg;
      bestStartIdx = i;
    }
  }
  return {
    startTime: next24[bestStartIdx]?.time || fallbackTime,
    endTime: next24[Math.min(bestStartIdx + 2, next24.length - 1)]?.time || fallbackTime,
    expectedPm25: Number((Number.isFinite(lowestAvgPm25) ? lowestAvgPm25 : 0).toFixed(1)),
  };
}

function aggregateDailyHistory(aq: OpenMeteoAirQualityResponse, nowIdx: number) {
  const times = aq.hourly.time || [];
  const todayDate = aq.current.time.slice(0, 10);
  const dailyMap = new Map<
    string,
    { aqiSum: number; aqiMax: number; pm25Sum: number; pm25Max: number; no2Sum: number; o3Sum: number; count: number }
  >();

  for (let i = 0; i <= Math.min(nowIdx, times.length - 1); i++) {
    const date = times[i].slice(0, 10);
    if (date > todayDate) continue;
    const aqiVal = aq.hourly.us_aqi[i];
    const pm25Val = aq.hourly.pm2_5[i];
    if (aqiVal === null || pm25Val === null) continue;

    const entry = dailyMap.get(date) || {
      aqiSum: 0,
      aqiMax: 0,
      pm25Sum: 0,
      pm25Max: 0,
      no2Sum: 0,
      o3Sum: 0,
      count: 0,
    };
    entry.aqiSum += aqiVal;
    entry.aqiMax = Math.max(entry.aqiMax, aqiVal);
    entry.pm25Sum += pm25Val;
    entry.pm25Max = Math.max(entry.pm25Max, pm25Val);
    entry.no2Sum += aq.hourly.nitrogen_dioxide[i] ?? 0;
    entry.o3Sum += aq.hourly.ozone[i] ?? 0;
    entry.count += 1;
    dailyMap.set(date, entry);
  }

  return Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, agg]) => ({
      date,
      avgAqi: Math.round(agg.aqiSum / agg.count),
      peakAqi: Math.round(agg.aqiMax),
      avgPm25: Number((agg.pm25Sum / agg.count).toFixed(1)),
      peakPm25: Number(agg.pm25Max.toFixed(1)),
      avgNo2: Number((agg.no2Sum / agg.count).toFixed(1)),
      avgO3: Number((agg.o3Sum / agg.count).toFixed(1)),
    }));
}

export async function fetchLocalAirQualityTelemetry(lat: number, lon: number) {
  const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const cached = aqCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  let pending = aqInflight.get(cacheKey);
  if (!pending) {
    pending = (async () => {
      const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,european_aqi&hourly=us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone&past_days=14&forecast_days=3&timezone=auto`;
      const wxUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&hourly=temperature_2m,wind_speed_10m&past_days=14&forecast_days=3&timezone=auto`;

      const [aqRes, wxRes] = await Promise.all([
        fetch(aqUrl, { signal: AbortSignal.timeout(8000) }),
        fetch(wxUrl, { signal: AbortSignal.timeout(8000) }),
      ]);
      if (!aqRes.ok) {
        throw new Error(`Air Quality API returned HTTP ${aqRes.status}`);
      }

      const aq = (await aqRes.json()) as OpenMeteoAirQualityResponse;
      let wxCurrent = { temperature_2m: 22, relative_humidity_2m: 50, wind_speed_10m: 8 };
      let wxHourlyWind: (number | null)[] = [];

      if (wxRes.ok) {
        const wx = (await wxRes.json()) as OpenMeteoWeatherResponse;
        if (wx.current) {
          wxCurrent = {
            temperature_2m: wx.current.temperature_2m ?? 22,
            relative_humidity_2m: wx.current.relative_humidity_2m ?? 50,
            wind_speed_10m: wx.current.wind_speed_10m ?? 8,
          };
        }
        wxHourlyWind = wx.hourly?.wind_speed_10m || [];
      }

      const times = aq.hourly.time || [];
      const currentTimeStr = aq.current.time;
      const currentDatePrefix = currentTimeStr.slice(0, 13);
      let nowIdx = times.findIndex((t) => t.startsWith(currentDatePrefix));
      if (nowIdx === -1) {
        nowIdx = Math.max(0, times.length - 72);
      }

      const hourlyForecast = buildHourlyForecast(aq, wxHourlyWind, wxCurrent.wind_speed_10m, nowIdx);
      const next24 = hourlyForecast.slice(0, 24);
      const ventilationWindow = findBestVentilationWindow(next24, currentTimeStr);
      const peak24h = next24.reduce(
        (max, h) => (h.usAqi > max.usAqi ? h : max),
        next24[0] || { time: currentTimeStr, usAqi: aq.current.us_aqi, pm25: aq.current.pm2_5 }
      );
      const dailyHistory = aggregateDailyHistory(aq, nowIdx);
      const usAqi = Math.round(aq.current.us_aqi ?? 0);
      const category = getAqiCategory(usAqi);

      const payload = {
        timezone: aq.timezone,
        observedAt: aq.current.time,
        current: {
          usAqi,
          europeanAqi: Math.round(aq.current.european_aqi ?? 0),
          category: category.label,
          severity: category.severity,
          pm25: Number((aq.current.pm2_5 ?? 0).toFixed(1)),
          pm10: Number((aq.current.pm10 ?? 0).toFixed(1)),
          no2: Number((aq.current.nitrogen_dioxide ?? 0).toFixed(1)),
          o3: Number((aq.current.ozone ?? 0).toFixed(1)),
          so2: Number((aq.current.sulphur_dioxide ?? 0).toFixed(1)),
          co: Number((aq.current.carbon_monoxide ?? 0).toFixed(0)),
          temperatureC: Number(wxCurrent.temperature_2m.toFixed(1)),
          humidityPct: Math.round(wxCurrent.relative_humidity_2m),
          windSpeedKmh: Number(wxCurrent.wind_speed_10m.toFixed(1)),
        },
        ventilationWindow,
        peakNext24h: {
          time: peak24h.time,
          usAqi: peak24h.usAqi,
          pm25: peak24h.pm25,
        },
        hourlyForecast,
        dailyHistory,
      };

      setBoundedCache(aqCache, cacheKey, payload, AQ_TTL_MS);
      return payload;
    })().finally(() => {
      aqInflight.delete(cacheKey);
    });
    aqInflight.set(cacheKey, pending);
  }

  return pending;
}
