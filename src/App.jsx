import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const WEATHER_API_BASE = "https://api.open-meteo.com/v1/forecast";
const REVERSE_GEOCODE_API =
  "https://api.bigdatacloud.net/data/reverse-geocode-client";
const QUOTE_API = "https://v1.hitokoto.cn/?c=c";
const DEFAULT_BACKGROUND =
  "https://www.bing.com/th?id=OHR.SpaceTrails_ZH-CN8377463217_1920x1080.jpg";
const FALLBACK_BACKGROUND =
  "https://bing.biturl.top/?resolution=1920&format=image&index=0&mkt=zh-CN";
const FALLBACK_LOCATION = {
  label: "上海市宝山区",
  latitude: 31.4053,
  longitude: 121.4894,
  source: "fallback"
};
const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 6000,
  maximumAge: 15 * 60 * 1000
};
const SETTINGS_STORAGE_KEY = "wallpaper-settings";
const DEFAULT_SETTINGS = {
  useBrowserLocation: true
};

const LOCAL_QUOTES = [
  { text: "专注此刻，时间会给努力最好的答案。", source: "每日一言" },
  { text: "把今天走稳，明天自然会更清晰。", source: "每日一言" },
  { text: "安静做事的人，也会被时间看见。", source: "每日一言" },
  { text: "每一次认真开始，都会让未来轻一点。", source: "每日一言" },
  { text: "慢一点没关系，别停在原地。", source: "每日一言" }
];

const WEEKDAYS = [
  "星期日",
  "星期一",
  "星期二",
  "星期三",
  "星期四",
  "星期五",
  "星期六"
];

function App() {
  const [now, setNow] = useState(() => new Date());
  const [backgroundUrl, setBackgroundUrl] = useState(DEFAULT_BACKGROUND);
  const [weather, setWeather] = useState({
    temp: null,
    code: 0,
    status: "loading"
  });
  const [location, setLocation] = useState(FALLBACK_LOCATION);
  const [quote, setQuote] = useState(() => randomLocalQuote());
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [settings, setSettings] = useState(() => readStoredSettings());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const dateTapCountRef = useRef(0);
  const dateTapTimerRef = useRef(null);

  const refreshQuote = useCallback(async () => {
    setIsQuoteLoading(true);
    const startedAt = Date.now();

    try {
      const data = await fetchJsonWithTimeout(QUOTE_API, 2200);
      const text = String(data?.hitokoto || "").trim();
      const source = String(data?.from_who || data?.from || "每日一言").trim();

      if (!text) {
        throw new Error("empty quote");
      }

      setQuote({ text, source });
    } catch (_error) {
      setQuote(randomLocalQuote());
    } finally {
      const elapsed = Date.now() - startedAt;
      const delay = Math.max(0, 320 - elapsed);
      window.setTimeout(() => setIsQuoteLoading(false), delay);
    }
  }, []);

  const refreshWeather = useCallback(async () => {
    try {
      const nextLocation = await resolveClientLocation(
        settings.useBrowserLocation
      );
      setLocation(nextLocation);

      const data = await fetchJsonWithTimeout(
        buildWeatherApiUrl(nextLocation),
        3000
      );
      const current = data?.current_weather;

      if (!current) {
        throw new Error("missing weather");
      }

      setWeather({
        temp: Math.round(current.temperature),
        code: Number(current.weathercode || 0),
        status: "ready"
      });
    } catch (_error) {
      setLocation(FALLBACK_LOCATION);
      setWeather((previous) => ({
        ...previous,
        temp: null,
        status: "error"
      }));
    }
  }, [settings.useBrowserLocation]);

  const refreshBackground = useCallback(async () => {
    try {
      const data = await fetchJsonWithTimeout("/api/bing-image", 3000);
      const url = String(data?.url || "").trim();
      setBackgroundUrl(url || FALLBACK_BACKGROUND);
    } catch (_error) {
      setBackgroundUrl(FALLBACK_BACKGROUND);
    }
  }, []);

  useEffect(() => {
    let timerId;

    const tick = () => {
      const next = new Date();
      setNow(next);
      timerId = window.setTimeout(tick, 1000 - next.getMilliseconds());
    };

    tick();
    return () => window.clearTimeout(timerId);
  }, []);

  useEffect(() => {
    refreshWeather();
    const timerId = window.setInterval(refreshWeather, 30 * 60 * 1000);
    return () => window.clearInterval(timerId);
  }, [refreshWeather]);

  useEffect(() => {
    refreshQuote();
    const timerId = window.setInterval(refreshQuote, 60 * 60 * 1000);
    return () => window.clearInterval(timerId);
  }, [refreshQuote]);

  useEffect(() => {
    refreshBackground();
    const timerId = window.setInterval(refreshBackground, 6 * 60 * 60 * 1000);
    return () => window.clearInterval(timerId);
  }, [refreshBackground]);

  useEffect(() => {
    writeStoredSettings(settings);
  }, [settings]);

  useEffect(() => {
    return () => window.clearTimeout(dateTapTimerRef.current);
  }, []);

  const handleDateBarClick = useCallback(() => {
    window.clearTimeout(dateTapTimerRef.current);
    dateTapCountRef.current += 1;

    if (dateTapCountRef.current >= 5) {
      dateTapCountRef.current = 0;
      setIsSettingsOpen(true);
      return;
    }

    dateTapTimerRef.current = window.setTimeout(() => {
      dateTapCountRef.current = 0;
    }, 1800);
  }, []);

  const handleDateBarKeyDown = useCallback(
    (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      handleDateBarClick();
    },
    [handleDateBarClick]
  );

  const handleBrowserLocationChange = useCallback((enabled) => {
    setSettings((previous) => ({
      ...previous,
      useBrowserLocation: enabled
    }));
  }, []);

  const timeParts = useMemo(() => {
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return { hours, minutes, seconds };
  }, [now]);

  const dateLabel = `${now.getMonth() + 1}月${now.getDate()}日 ${
    WEEKDAYS[now.getDay()]
  }`;
  const greeting = getGreeting(now.getHours());

  return (
    <main
      className="wallpaper"
      style={{ "--wallpaper-image": `url("${escapeCssUrl(backgroundUrl)}")` }}
    >
      <section className="clock-container" aria-label="滚动时钟壁纸">
        <header
          className="info-header"
          role="button"
          tabIndex={0}
          aria-label="日期与天气"
          onClick={handleDateBarClick}
          onKeyDown={handleDateBarKeyDown}
        >
          <div className="date-label">{dateLabel}</div>
          <div className="weather-info" aria-live="polite">
            <span className="city-name">{location.label}</span>
            <WeatherIcon code={weather.code} status={weather.status} />
            <span className="weather-temp">
              {weather.temp == null ? "--°C" : `${weather.temp}°C`}
            </span>
          </div>
        </header>

        <div className="clock-main" aria-label={formatTimeLabel(timeParts)}>
          <DigitGroup value={timeParts.hours} firstMax={2} />
          <span className="time-separator">:</span>
          <DigitGroup value={timeParts.minutes} firstMax={5} />
          <span className="time-separator">:</span>
          <DigitGroup value={timeParts.seconds} firstMax={5} />
        </div>

        <footer className="footer-content">
          <div className="greeting">{greeting}</div>
          <div className={`quote-shell${isQuoteLoading ? " loading" : ""}`}>
            <p className="quote-text">“{quote.text}”</p>
            <div className="quote-source">—— {quote.source}</div>
            <button
              className={`quote-refresh-btn${
                isQuoteLoading ? " spinning" : ""
              }`}
              type="button"
              title="换一句"
              aria-label="刷新语录"
              onClick={refreshQuote}
            >
              <RefreshIcon />
            </button>
          </div>
        </footer>
      </section>

      {isSettingsOpen && (
        <SettingsDialog
          location={location}
          settings={settings}
          weatherStatus={weather.status}
          onBrowserLocationChange={handleBrowserLocationChange}
          onClose={() => setIsSettingsOpen(false)}
          onRefreshBackground={refreshBackground}
          onRefreshQuote={refreshQuote}
          onRefreshWeather={refreshWeather}
        />
      )}
    </main>
  );
}

function SettingsDialog({
  location,
  onBrowserLocationChange,
  onClose,
  onRefreshBackground,
  onRefreshQuote,
  onRefreshWeather,
  settings,
  weatherStatus
}) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="settings-layer" onMouseDown={onClose}>
      <section
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="settings-header">
          <h2 id="settings-title">设置</h2>
          <button
            className="settings-icon-btn"
            type="button"
            aria-label="关闭设置"
            onClick={onClose}
            ref={closeButtonRef}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="settings-list">
          <label className="settings-row settings-toggle-row">
            <span className="settings-copy">
              <span className="settings-label">浏览器定位</span>
              <span className="settings-description">
                关闭后使用上海市宝山区
              </span>
            </span>
            <input
              className="settings-switch"
              type="checkbox"
              checked={settings.useBrowserLocation}
              onChange={(event) =>
                onBrowserLocationChange(event.target.checked)
              }
            />
          </label>

          <div className="settings-row">
            <span className="settings-copy">
              <span className="settings-label">天气位置</span>
              <span className="settings-description">
                {location.source === "fallback" ? "默认位置" : "当前定位"}
              </span>
            </span>
            <span className="settings-value">{location.label}</span>
          </div>

          <div className="settings-row">
            <span className="settings-copy">
              <span className="settings-label">天气状态</span>
              <span className="settings-description">
                {resolveWeatherStatusText(weatherStatus)}
              </span>
            </span>
            <button
              className="settings-action-btn"
              type="button"
              onClick={onRefreshWeather}
            >
              刷新天气
            </button>
          </div>
        </div>

        <div className="settings-actions">
          <button
            className="settings-action-btn"
            type="button"
            onClick={onRefreshBackground}
          >
            刷新壁纸
          </button>
          <button
            className="settings-action-btn"
            type="button"
            onClick={onRefreshQuote}
          >
            刷新语录
          </button>
        </div>
      </section>
    </div>
  );
}

function DigitGroup({ value, firstMax }) {
  return (
    <div className="digit-group" aria-hidden="true">
      <RollingDigit value={Number(value[0])} max={firstMax} />
      <RollingDigit value={Number(value[1])} max={9} />
    </div>
  );
}

function RollingDigit({ value, max }) {
  const previousRef = useRef(value);
  const resetTimerRef = useRef(null);
  const [position, setPosition] = useState(value);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const previous = previousRef.current;

    if (previous === value) {
      return undefined;
    }

    window.clearTimeout(resetTimerRef.current);
    setAnimate(true);

    if (previous === max && value === 0) {
      setPosition(max + 1);
      resetTimerRef.current = window.setTimeout(() => {
        setAnimate(false);
        setPosition(0);
      }, 620);
    } else {
      setPosition(value);
    }

    previousRef.current = value;

    return () => window.clearTimeout(resetTimerRef.current);
  }, [max, value]);

  const digits = [];
  for (let i = 0; i <= max; i += 1) {
    digits.push(i);
  }
  digits.push(0);

  return (
    <div className="digit-container">
      <div
        className="digit-strip"
        style={{
          transform: `translate3d(0, calc(-1 * var(--digit-height) * ${position}), 0)`,
          transition: animate
            ? "transform 600ms cubic-bezier(0.65, 0, 0.35, 1)"
            : "none"
        }}
      >
        {digits.map((digit, index) => (
          <span className="digit" key={`${digit}-${index}`}>
            {digit}
          </span>
        ))}
      </div>
    </div>
  );
}

function WeatherIcon({ code, status }) {
  const icon = resolveWeatherIcon(code, status);

  if (icon === "rain") {
    return (
      <svg className="weather-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19.4 10.1A7.5 7.5 0 0 0 5.3 8.2 6 6 0 0 0 6 20h13a5 5 0 0 0 .4-9.9Z" />
        <path d="M8 17.5h.01M12 19h.01M16 17.5h.01" />
      </svg>
    );
  }

  if (icon === "snow") {
    return (
      <svg className="weather-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19.4 10.1A7.5 7.5 0 0 0 5.3 8.2 6 6 0 0 0 6 20h13a5 5 0 0 0 .4-9.9Z" />
        <path d="M9 16h.01M12 18.5h.01M15 16h.01" />
      </svg>
    );
  }

  if (icon === "cloudy") {
    return (
      <svg className="weather-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19.4 10.1A7.5 7.5 0 0 0 5.3 8.2 6 6 0 0 0 6 20h13a5 5 0 0 0 .4-9.9Z" />
      </svg>
    );
  }

  return (
    <svg className="weather-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4.8" />
      <path d="M12 1.8v2.4M12 19.8v2.4M4.8 4.8l1.7 1.7M17.5 17.5l1.7 1.7M1.8 12h2.4M19.8 12h2.4M4.8 19.2l1.7-1.7M17.5 6.5l1.7-1.7" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 12a9 9 0 0 1-15.3 6.4L3 16" />
      <path d="M3 21v-5h5" />
      <path d="M3 12A9 9 0 0 1 18.3 5.6L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function resolveClientLocation(useBrowserLocation) {
  if (!useBrowserLocation || !("geolocation" in navigator)) {
    return FALLBACK_LOCATION;
  }

  try {
    const position = await getCurrentPosition(GEOLOCATION_OPTIONS);
    const latitude = Number(position.coords.latitude);
    const longitude = Number(position.coords.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error("invalid geolocation");
    }

    let label = "当前位置";
    try {
      label = (await resolveLocationLabel(latitude, longitude)) || label;
    } catch (_error) {
      label = "当前位置";
    }

    return {
      label,
      latitude,
      longitude,
      source: "client"
    };
  } catch (_error) {
    return FALLBACK_LOCATION;
  }
}

function getCurrentPosition(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

async function resolveLocationLabel(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    localityLanguage: "zh"
  });
  const data = await fetchJsonWithTimeout(
    `${REVERSE_GEOCODE_API}?${params}`,
    3000
  );

  return formatLocationLabel(data);
}

function formatLocationLabel(data) {
  const city = cleanLocationPart(data?.city);
  const locality = cleanLocationPart(data?.locality);
  const district = cleanLocationPart(data?.localityInfo?.administrative?.[3]?.name);
  const principalSubdivision = cleanLocationPart(data?.principalSubdivision);
  const countryName = cleanLocationPart(data?.countryName);

  if (city && locality && city !== locality) {
    return `${city}${locality}`;
  }
  if (city && district && city !== district) {
    return `${city}${district}`;
  }
  if (city) {
    return city;
  }
  if (locality) {
    return locality;
  }
  if (district && principalSubdivision && district !== principalSubdivision) {
    return `${principalSubdivision}${district}`;
  }
  return district || principalSubdivision || countryName || "";
}

function cleanLocationPart(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .trim();
}

function buildWeatherApiUrl({ latitude, longitude }) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current_weather: "true",
    timezone: "auto"
  });
  return `${WEATHER_API_BASE}?${params}`;
}

function randomLocalQuote() {
  return LOCAL_QUOTES[Math.floor(Math.random() * LOCAL_QUOTES.length)];
}

function readStoredSettings() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      useBrowserLocation:
        typeof parsed.useBrowserLocation === "boolean"
          ? parsed.useBrowserLocation
          : DEFAULT_SETTINGS.useBrowserLocation
    };
  } catch (_error) {
    return DEFAULT_SETTINGS;
  }
}

function writeStoredSettings(settings) {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (_error) {
    // Local storage can be unavailable in hardened browser contexts.
  }
}

function resolveWeatherStatusText(status) {
  if (status === "ready") {
    return "已更新";
  }
  if (status === "loading") {
    return "更新中";
  }
  return "暂不可用";
}

function getGreeting(hour) {
  if (hour >= 5 && hour < 7) {
    return "晨光初起，把注意力交给最重要的事";
  }
  if (hour >= 7 && hour < 12) {
    return "早安，今天也适合稳稳推进";
  }
  if (hour >= 12 && hour < 14) {
    return "午间小憩，让节奏重新变轻";
  }
  if (hour >= 14 && hour < 18) {
    return "下午继续，清晰比匆忙更重要";
  }
  if (hour >= 18 && hour < 22) {
    return "夜色温柔，适合整理今天的收获";
  }
  return "深夜安静，愿每一分钟都有方向";
}

function formatTimeLabel({ hours, minutes, seconds }) {
  return `${hours}:${minutes}:${seconds}`;
}

function resolveWeatherIcon(code, status) {
  if (status === "error") {
    return "cloudy";
  }
  if (code >= 71) {
    return "snow";
  }
  if (code >= 51) {
    return "rain";
  }
  if (code >= 2) {
    return "cloudy";
  }
  return "clear";
}

function escapeCssUrl(url) {
  return String(url).replace(/["\\]/g, "\\$&");
}

export default App;
