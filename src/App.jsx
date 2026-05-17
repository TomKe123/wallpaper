import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Cloud,
  CloudRain,
  CloudSnow,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Sun,
  Trash2,
  ZoomIn,
  X
} from "lucide-react";

const WEATHER_API_BASE = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_API_BASE = "https://geocoding-api.open-meteo.com/v1/search";
const REVERSE_GEOCODE_API =
  "https://api.bigdatacloud.net/data/reverse-geocode-client";
const LOCATION_SEARCH_API = "/api/location-search";
const QUOTE_API_BASE = "https://v1.hitokoto.cn";
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
const MIN_PAGE_SCALE = 0.5;
const MAX_PAGE_SCALE = 1.3;
const PAGE_SCALE_STEP = 0.01;
const MIN_QUOTE_REFRESH_MINUTES = 1;
const MAX_QUOTE_REFRESH_MINUTES = 1440;
const DEFAULT_QUOTE_CATEGORY = "c";
const DEFAULT_QUOTE_FILTERS = [
  { source: "原神", category: DEFAULT_QUOTE_CATEGORY },
  { source: "崩坏：星穹铁道", category: DEFAULT_QUOTE_CATEGORY },
  { source: "崩坏3", category: DEFAULT_QUOTE_CATEGORY }
];
const DEFAULT_SETTINGS = {
  locationMode: "browser",
  manualLocation: FALLBACK_LOCATION,
  pageScale: 1,
  quoteRefreshMinutes: 5,
  quoteFilters: DEFAULT_QUOTE_FILTERS
};
const MAX_QUOTE_FETCH_ATTEMPTS = 8;
const QUOTE_RETRY_DELAY_MS = 250;
const QUOTE_API_TIMEOUT_MS = 1800;
const HITOKOTO_CATEGORIES = [
  { code: "a", label: "动画" },
  { code: "b", label: "漫画" },
  { code: "c", label: "游戏" },
  { code: "d", label: "文学" },
  { code: "e", label: "原创" },
  { code: "f", label: "网络" },
  { code: "g", label: "其他" },
  { code: "h", label: "影视" },
  { code: "i", label: "诗词" },
  { code: "j", label: "网易云" },
  { code: "k", label: "哲学" },
  { code: "l", label: "抖机灵" }
];

const LOCAL_QUOTES = [
  { text: "旅途的意义，就是不断遇见新的风景。", source: "原神" },
  { text: "当你重新踏上旅途之后，一定要记得旅途本身的意义。", source: "原神" },
  { text: "风带来了故事的种子，时间使其发芽。", source: "原神" },
  { text: "在永恒中寻找变化，在变化中寻找永恒。", source: "原神" },
  { text: "只要不失去你的崇高，整个世界都会为你敞开。", source: "原神" },
  { text: "不要害怕犯错，那是成长的必经之路。", source: "原神" },
  { text: "愿此行，终抵群星。", source: "崩坏：星穹铁道" },
  { text: "宇宙很大，生活更大。", source: "崩坏：星穹铁道" },
  { text: "开拓者，不必匆忙，一步一步走就好。", source: "崩坏：星穹铁道" },
  { text: "规则，就是用来打破的。", source: "崩坏：星穹铁道" },
  { text: "列车前进的方向，就是家的方向。", source: "崩坏：星穹铁道" },
  { text: "每个人的心里都住着一个英雄。", source: "崩坏：星穹铁道" },
  { text: "为世界上所有的美好而战。", source: "崩坏3" },
  { text: "我将坠入黑暗，换你回到光明。", source: "崩坏3" },
  { text: "活着，就是一场盛大的战斗。", source: "崩坏3" },
  { text: "痛苦教会我们珍惜，失去教会我们守护。", source: "崩坏3" },
  { text: "终点并不重要，重要的是沿途的风景与同伴。", source: "原神" },
  { text: "奇迹从来不是等来的，是拼出来的。", source: "崩坏：星穹铁道" },
  { text: "未知并不可怕，可怕的是失去探索的勇气。", source: "崩坏：星穹铁道" },
  { text: "即使身处黑暗，也要心向光明。", source: "崩坏3" },
  { text: "出发吧，去追寻属于你的星辰。", source: "原神" },
  { text: "所谓成长，就是不断告别过去的自己。", source: "原神" },
  { text: "如果停下来，就永远到不了想去的地方。", source: "崩坏：星穹铁道" },
  { text: "战斗不是为了一时的胜利，而是为了守护珍视之物。", source: "崩坏3" },
  { text: "时间不会等待，但我们可以选择如何度过。", source: "原神" },
  { text: "所有的相遇，都是久别重逢。", source: "原神" },
  { text: "向着星辰与深渊，前进吧。", source: "原神" },
  { text: "空洞虽险，但机遇并存。", source: "绝区零" },
  { text: "在这个世界活下去，本身就是一种奇迹。", source: "绝区零" },
  { text: "每一天都是崭新的冒险。", source: "绝区零" }
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
  const shouldReduceMotion = useReducedMotion();
  const [now, setNow] = useState(() => new Date());
  const [backgroundUrl, setBackgroundUrl] = useState(DEFAULT_BACKGROUND);
  const [weather, setWeather] = useState({
    temp: null,
    code: 0,
    status: "loading"
  });
  const [location, setLocation] = useState(FALLBACK_LOCATION);
  const [quote, setQuote] = useState(() => randomLocalQuote(DEFAULT_SETTINGS));
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [settings, setSettings] = useState(() => readStoredSettings());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const quoteRef = useRef(quote);
  const dateTapCountRef = useRef(0);
  const dateTapTimerRef = useRef(null);

  useEffect(() => {
    quoteRef.current = quote;
  }, [quote]);

  const refreshQuote = useCallback(async () => {
    setIsQuoteLoading(true);
    const startedAt = Date.now();
    const previousQuote = quoteRef.current;

    try {
      const quoteResult = await fetchFilteredQuote(settings, previousQuote);
      setQuote(quoteResult);
    } catch (_error) {
      setQuote(randomLocalQuote(settings, previousQuote));
    } finally {
      const elapsed = Date.now() - startedAt;
      const delay = Math.max(0, 320 - elapsed);
      window.setTimeout(() => setIsQuoteLoading(false), delay);
    }
  }, [settings]);

  const refreshWeather = useCallback(async () => {
    let nextLocation = null;

    try {
      nextLocation = await resolveWeatherLocation(settings);
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
      if (!nextLocation) {
        setLocation(FALLBACK_LOCATION);
      }
      setWeather((previous) => ({
        ...previous,
        temp: null,
        status: "error"
      }));
    }
  }, [settings]);

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
    const refreshMs = settings.quoteRefreshMinutes * 60 * 1000;
    const timerId = window.setInterval(refreshQuote, refreshMs);
    return () => window.clearInterval(timerId);
  }, [refreshQuote, settings.quoteRefreshMinutes]);

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

  const handleLocationModeChange = useCallback((mode) => {
    setSettings((previous) => ({
      ...previous,
      locationMode: mode
    }));
  }, []);

  const handleManualLocationChange = useCallback((manualLocation) => {
    const normalized = normalizeLocation(manualLocation);
    if (!normalized) return;

    setLocation(normalized);
    setWeather((previous) => ({
      ...previous,
      status: "loading"
    }));
    setSettings((previous) => ({
      ...previous,
      locationMode: "manual",
      manualLocation: normalized
    }));
  }, []);

  useEffect(() => {
    if (settings.locationMode === "manual") {
      setLocation(normalizeLocation(settings.manualLocation) || FALLBACK_LOCATION);
    }
  }, [settings.locationMode, settings.manualLocation]);

  const handlePageScaleChange = useCallback((pageScale) => {
    setSettings((previous) => ({
      ...previous,
      pageScale: normalizePageScale(pageScale)
    }));
  }, []);

  const handleQuoteRefreshMinutesChange = useCallback((minutes) => {
    setSettings((previous) => ({
      ...previous,
      quoteRefreshMinutes: normalizeQuoteRefreshMinutes(minutes)
    }));
  }, []);

  const handleAddQuoteFilter = useCallback((source, category) => {
    const normalized = cleanQuoteSource(source);
    if (!normalized) return;
    const normalizedCategory = normalizeQuoteCategory(category) || DEFAULT_QUOTE_CATEGORY;

    setSettings((previous) => {
      const existing = normalizeQuoteFilters(previous);
      if (existing.some((item) => isSameQuoteSource(item.source, normalized))) {
        return previous;
      }
      return {
        ...previous,
        quoteFilters: [
          ...existing,
          { source: normalized, category: normalizedCategory }
        ]
      };
    });
  }, []);

  const handleRemoveQuoteFilter = useCallback((source) => {
    setSettings((previous) => ({
      ...previous,
      quoteFilters: normalizeQuoteFilters(previous).filter(
        (item) => !isSameQuoteSource(item.source, source)
      )
    }));
  }, []);

  const handleQuoteFilterCategoryChange = useCallback((source, category) => {
    setSettings((previous) => ({
      ...previous,
      quoteFilters: normalizeQuoteFilters(previous).map((item) =>
        isSameQuoteSource(item.source, source)
          ? {
              ...item,
              category: normalizeQuoteCategory(category) || DEFAULT_QUOTE_CATEGORY
            }
          : item
      )
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
  const shellMotion = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] }
      };

  return (
    <main
      className="wallpaper"
      style={{
        "--page-scale": settings.pageScale,
        "--wallpaper-image": `url("${escapeCssUrl(backgroundUrl)}")`
      }}
    >
      <motion.section
        className="clock-container"
        aria-label="滚动时钟壁纸"
        {...shellMotion}
      >
        <motion.header
          className="info-header"
          role="button"
          tabIndex={0}
          aria-label="日期与天气"
          onClick={handleDateBarClick}
          onKeyDown={handleDateBarKeyDown}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
        >
          <div className="date-label">{dateLabel}</div>
          <div className="weather-info" aria-live="polite">
            <span className="city-name">{location.label}</span>
            <WeatherIcon code={weather.code} status={weather.status} />
            <span className="weather-temp">
              {weather.temp == null ? "--°C" : `${weather.temp}°C`}
            </span>
          </div>
        </motion.header>

        <motion.div
          className="clock-main"
          aria-label={formatTimeLabel(timeParts)}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
          animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: "easeOut" }}
        >
          <DigitGroup value={timeParts.hours} firstMax={2} />
          <span className="time-separator">:</span>
          <DigitGroup value={timeParts.minutes} firstMax={5} />
          <span className="time-separator">:</span>
          <DigitGroup value={timeParts.seconds} firstMax={5} />
        </motion.div>

        <footer className="footer-content">
          <motion.div
            className="greeting"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.18 }}
          >
            {greeting}
          </motion.div>

          <motion.div
            className={`quote-shell${isQuoteLoading ? " loading" : ""}`}
            layout={!shouldReduceMotion}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.24 }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${quote.text}-${quote.source}`}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
              >
                <p className="quote-text">“{quote.text}”</p>
                <div className="quote-source">{formatQuoteSource(quote)}</div>
              </motion.div>
            </AnimatePresence>
            <IconButton
              className="quote-refresh-btn"
              label="刷新语录"
              title="换一句"
              onClick={refreshQuote}
              spin={isQuoteLoading}
            >
              <RefreshCw aria-hidden="true" />
            </IconButton>
          </motion.div>
        </footer>
      </motion.section>

      <SettingsDialog
        location={location}
        open={isSettingsOpen}
        settings={settings}
        weatherStatus={weather.status}
        onLocationModeChange={handleLocationModeChange}
        onManualLocationChange={handleManualLocationChange}
        onOpenChange={setIsSettingsOpen}
        onRefreshBackground={refreshBackground}
        onRefreshQuote={refreshQuote}
        onRefreshWeather={refreshWeather}
        onPageScaleChange={handlePageScaleChange}
        onQuoteRefreshMinutesChange={handleQuoteRefreshMinutesChange}
        onAddQuoteFilter={handleAddQuoteFilter}
        onRemoveQuoteFilter={handleRemoveQuoteFilter}
        onQuoteFilterCategoryChange={handleQuoteFilterCategoryChange}
      />
    </main>
  );
}

function SettingsDialog({
  location,
  onAddQuoteFilter,
  onLocationModeChange,
  onManualLocationChange,
  onOpenChange,
  onPageScaleChange,
  onQuoteFilterCategoryChange,
  onQuoteRefreshMinutesChange,
  onRefreshBackground,
  onRefreshQuote,
  onRefreshWeather,
  onRemoveQuoteFilter,
  open,
  settings,
  weatherStatus
}) {
  const shouldReduceMotion = useReducedMotion();
  const pageScale = normalizePageScale(settings.pageScale);
  const pageScalePercent = Math.round(pageScale * 100);
  const quoteRefreshMinutes = normalizeQuoteRefreshMinutes(
    settings.quoteRefreshMinutes
  );
  const quoteFilters = normalizeQuoteFilters(settings);
  const [sourceInput, setSourceInput] = useState("");
  const [sourceCategory, setSourceCategory] = useState(DEFAULT_QUOTE_CATEGORY);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState([]);
  const [locationSearchError, setLocationSearchError] = useState("");
  const [isLocationSearching, setIsLocationSearching] = useState(false);
  const [pageScaleInput, setPageScaleInput] = useState(String(pageScalePercent));

  useEffect(() => {
    if (!open) {
      setSourceInput("");
      setSourceCategory(DEFAULT_QUOTE_CATEGORY);
      setLocationQuery("");
      setLocationResults([]);
      setLocationSearchError("");
      setIsLocationSearching(false);
    }
  }, [open]);

  useEffect(() => {
    setPageScaleInput(String(pageScalePercent));
  }, [pageScalePercent]);

  const handleLocationSearch = async (event) => {
    event.preventDefault();
    const query = locationQuery.trim();
    if (query.length < 2) {
      setLocationSearchError("请输入至少两个字符");
      setLocationResults([]);
      return;
    }

    setIsLocationSearching(true);
    setLocationSearchError("");

    try {
      const results = await searchLocations(query);
      setLocationResults(results);
      if (!results.length) {
        setLocationSearchError("没有找到匹配地点");
      }
    } catch (_error) {
      setLocationResults([]);
      setLocationSearchError("地点搜索暂不可用");
    } finally {
      setIsLocationSearching(false);
    }
  };

  const handlePageScaleInputChange = (event) => {
    const value = event.target.value.replace(/[^\d.]/g, "");
    setPageScaleInput(value);

    if (!value || value === ".") {
      return;
    }

    const percent = Number(value);
    const minPercent = Math.round(MIN_PAGE_SCALE * 100);
    const maxPercent = Math.round(MAX_PAGE_SCALE * 100);
    if (Number.isFinite(percent) && percent >= minPercent && percent <= maxPercent) {
      onPageScaleChange(percent / 100);
    }
  };

  const commitPageScaleInput = () => {
    const percent = Number(pageScaleInput);
    if (!Number.isFinite(percent)) {
      setPageScaleInput(String(pageScalePercent));
      return;
    }

    const normalizedScale = normalizePageScale(percent / 100);
    onPageScaleChange(normalizedScale);
    setPageScaleInput(String(Math.round(normalizedScale * 100)));
  };

  const handlePageScaleInputKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitPageScaleInput();
    }
  };

  const handleSourceSubmit = (event) => {
    event.preventDefault();
    onAddQuoteFilter(sourceInput, sourceCategory);
    setSourceInput("");
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="settings-layer"
                initial={shouldReduceMotion ? false : { opacity: 0 }}
                animate={shouldReduceMotion ? undefined : { opacity: 1 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.section
                className="settings-panel"
                initial={
                  shouldReduceMotion
                    ? false
                    : { opacity: 0, scale: 0.96, x: "-50%", y: "-46%" }
                }
                animate={
                  shouldReduceMotion
                    ? undefined
                    : { opacity: 1, scale: 1, x: "-50%", y: "-50%" }
                }
                exit={
                  shouldReduceMotion
                    ? undefined
                    : { opacity: 0, scale: 0.96, x: "-50%", y: "-46%" }
                }
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <header className="settings-header">
                  <div className="settings-heading">
                    <Dialog.Title className="settings-title">
                      设置
                    </Dialog.Title>
                    <Dialog.Description className="settings-subtitle">
                      壁纸、定位和内容刷新
                    </Dialog.Description>
                  </div>
                  <Dialog.Close className="settings-icon-btn" aria-label="关闭设置">
                    <X aria-hidden="true" />
                  </Dialog.Close>
                </header>

                <div className="settings-list">
                  <section className="settings-block">
                    <div className="settings-block-head">
                      <span className="settings-label">
                        <ZoomIn aria-hidden="true" />
                        页面缩放
                      </span>
                      <span className="settings-description">
                        调整时钟、日期、天气和语录的整体显示大小
                      </span>
                    </div>

                    <label className="scale-control">
                      <input
                        aria-label="页面缩放大小"
                        className="scale-slider"
                        max={MAX_PAGE_SCALE}
                        min={MIN_PAGE_SCALE}
                        onChange={(event) => onPageScaleChange(event.target.value)}
                        step={PAGE_SCALE_STEP}
                        type="range"
                        value={pageScale}
                      />
                      <span className="scale-number">
                        <input
                          aria-label="手动输入缩放比例"
                          inputMode="numeric"
                          max={Math.round(MAX_PAGE_SCALE * 100)}
                          min={Math.round(MIN_PAGE_SCALE * 100)}
                          onBlur={commitPageScaleInput}
                          onChange={handlePageScaleInputChange}
                          onKeyDown={handlePageScaleInputKeyDown}
                          step="1"
                          type="number"
                          value={pageScaleInput}
                        />
                        <span>%</span>
                      </span>
                    </label>
                  </section>

                  <section className="settings-block">
                    <div className="settings-block-head">
                      <span className="settings-label">
                        <RefreshCw aria-hidden="true" />
                        自动刷新一言
                      </span>
                      <span className="settings-description">
                        设置语录自动刷新间隔，默认 5 分钟
                      </span>
                    </div>

                    <label className="settings-number-row">
                      <input
                        className="settings-text-input"
                        inputMode="numeric"
                        max={MAX_QUOTE_REFRESH_MINUTES}
                        min={MIN_QUOTE_REFRESH_MINUTES}
                        onChange={(event) =>
                          onQuoteRefreshMinutesChange(event.target.value)
                        }
                        step="1"
                        type="number"
                        value={quoteRefreshMinutes}
                      />
                      <span>分钟</span>
                    </label>
                  </section>

                  <section className="settings-block">
                    <div className="settings-block-head">
                      <span className="settings-label">
                        <Cloud aria-hidden="true" />
                        一言检索
                      </span>
                      <span className="settings-description">
                        每个来源词条都有自己的分类，刷新时会随机抽取一个词条
                      </span>
                    </div>

                    <form className="settings-inline-form" onSubmit={handleSourceSubmit}>
                      <input
                        className="settings-text-input"
                        value={sourceInput}
                        onChange={(event) => setSourceInput(event.target.value)}
                        placeholder="例如：原神、崩坏：星穹铁道"
                      />
                      <select
                        className="settings-select"
                        value={sourceCategory}
                        onChange={(event) => setSourceCategory(event.target.value)}
                        aria-label="新来源分类"
                      >
                        {HITOKOTO_CATEGORIES.map((category) => (
                          <option key={category.code} value={category.code}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                      <MotionButton ariaLabel="添加来源">
                        <Plus aria-hidden="true" />
                      </MotionButton>
                    </form>

                    <div className="source-chip-list" aria-label="来源筛选列表">
                      {quoteFilters.length ? (
                        quoteFilters.map((filter) => (
                          <div
                            className="source-chip"
                            key={filter.source}
                          >
                            <span>{filter.source}</span>
                            <select
                              value={filter.category}
                              onChange={(event) =>
                                onQuoteFilterCategoryChange(
                                  filter.source,
                                  event.target.value
                                )
                              }
                              aria-label={`${filter.source} 分类`}
                            >
                              {HITOKOTO_CATEGORIES.map((category) => (
                                <option key={category.code} value={category.code}>
                                  {category.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => onRemoveQuoteFilter(filter.source)}
                              title="移除此来源"
                              aria-label={`移除 ${filter.source}`}
                            >
                              <Trash2 aria-hidden="true" />
                            </button>
                          </div>
                        ))
                      ) : (
                        <span className="settings-empty-text">当前没有来源词条</span>
                      )}
                    </div>
                  </section>

                  <section className="settings-block">
                    <div className="settings-block-head">
                      <span className="settings-label">
                        <MapPin aria-hidden="true" />
                        定位方式
                      </span>
                      <span className="settings-description">
                        可以使用浏览器定位，也可以从国内区县中手动选择
                      </span>
                    </div>

                    <div className="settings-segmented" role="group" aria-label="定位方式">
                      <button
                        className={
                          settings.locationMode === "browser" ? "active" : ""
                        }
                        type="button"
                        onClick={() => onLocationModeChange("browser")}
                      >
                        浏览器定位
                      </button>
                      <button
                        className={
                          settings.locationMode === "manual" ? "active" : ""
                        }
                        type="button"
                        onClick={() => onLocationModeChange("manual")}
                      >
                        手动选择
                      </button>
                    </div>

                    <form className="settings-inline-form" onSubmit={handleLocationSearch}>
                      <input
                        className="settings-text-input"
                        value={locationQuery}
                        onChange={(event) => setLocationQuery(event.target.value)}
                        placeholder="搜索城市、区县或地名"
                      />
                      <MotionButton ariaLabel="搜索地点" disabled={isLocationSearching}>
                        <Search aria-hidden="true" />
                      </MotionButton>
                    </form>

                    <div className="location-current">
                      <span>当前天气位置</span>
                      <strong>{location.label}</strong>
                    </div>

                    {settings.manualLocation?.label && (
                      <div className="location-current">
                        <span>手动选择位置</span>
                        <strong>{settings.manualLocation.label}</strong>
                      </div>
                    )}

                    {locationSearchError && (
                      <div className="settings-error">{locationSearchError}</div>
                    )}

                    {locationResults.length > 0 && (
                      <div className="location-results" aria-label="地点搜索结果">
                        {locationResults.map((item) => (
                          <button
                            className="location-result"
                            type="button"
                            key={`${item.latitude}-${item.longitude}-${item.label}`}
                            onClick={() => onManualLocationChange(item)}
                          >
                            <span>{item.label}</span>
                            <small>
                              {item.latitude.toFixed(2)}, {item.longitude.toFixed(2)}
                            </small>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>

                  <div className="settings-row">
                    <span className="settings-copy">
                      <span className="settings-label">
                        <Cloud aria-hidden="true" />
                        天气状态
                      </span>
                      <span className="settings-description">
                        {resolveWeatherStatusText(weatherStatus)}
                      </span>
                    </span>
                    <MotionButton onClick={onRefreshWeather}>刷新天气</MotionButton>
                  </div>
                </div>

                <div className="settings-actions">
                  <MotionButton onClick={onRefreshBackground}>刷新壁纸</MotionButton>
                  <MotionButton onClick={onRefreshQuote}>刷新语录</MotionButton>
                </div>
              </motion.section>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function IconButton({ children, className, label, onClick, spin, title }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.button
      className={`${className || ""}${spin ? " is-spinning" : ""}`}
      type="button"
      title={title}
      aria-label={label}
      onClick={onClick}
      whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
    >
      {children}
    </motion.button>
  );
}

function MotionButton({ ariaLabel, children, disabled, onClick }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.button
      className="settings-action-btn"
      type={onClick ? "button" : "submit"}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      whileHover={disabled || shouldReduceMotion ? undefined : { y: -1 }}
      whileTap={disabled || shouldReduceMotion ? undefined : { scale: 0.97 }}
    >
      {children}
    </motion.button>
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
  const shouldReduceMotion = useReducedMotion();

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
      }, shouldReduceMotion ? 0 : 620);
    } else {
      setPosition(value);
    }

    previousRef.current = value;

    return () => window.clearTimeout(resetTimerRef.current);
  }, [max, shouldReduceMotion, value]);

  const digits = [];
  for (let i = 0; i <= max; i += 1) {
    digits.push(i);
  }
  digits.push(0);

  return (
    <div className="digit-container">
      <motion.div
        className="digit-strip"
        animate={{ y: `calc(-1 * var(--digit-height) * ${position})` }}
        transition={
          animate && !shouldReduceMotion
            ? { duration: 0.6, ease: [0.65, 0, 0.35, 1] }
            : { duration: 0 }
        }
      >
        {digits.map((digit, index) => (
          <span className="digit" key={`${digit}-${index}`}>
            {digit}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

function WeatherIcon({ code, status }) {
  const icon = resolveWeatherIcon(code, status);

  if (icon === "rain") {
    return <CloudRain className="weather-icon" aria-hidden="true" />;
  }
  if (icon === "snow") {
    return <CloudSnow className="weather-icon" aria-hidden="true" />;
  }
  if (icon === "cloudy") {
    return <Cloud className="weather-icon" aria-hidden="true" />;
  }
  return <Sun className="weather-icon" aria-hidden="true" />;
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

async function fetchFilteredQuote(settings, previousQuote) {
  const filter = randomQuoteFilter(settings);
  const apiUrl = buildQuoteApiUrl(filter?.category);
  const sourceFilter = filter?.source ? [filter.source] : [];

  for (let i = 0; i < MAX_QUOTE_FETCH_ATTEMPTS; i += 1) {
    try {
      const data = await fetchJsonWithTimeout(apiUrl, QUOTE_API_TIMEOUT_MS);
      const text = String(data?.hitokoto || "").trim();
      const from = String(data?.from || "").trim();
      const fromWho = String(data?.from_who || data?.from || "").trim();

      if (
        text &&
        !isSameQuoteText(text, previousQuote) &&
        quoteMatchesSources(from, sourceFilter)
      ) {
        return { text, source: fromWho || from };
      }
    } catch (_error) {
      // Retry below, matching the original single-file HTML behavior.
    }

    await delay(QUOTE_RETRY_DELAY_MS);
  }

  throw new Error("no matching quote");
}

function buildQuoteApiUrl(category) {
  const normalizedCategory = normalizeQuoteCategory(category);
  if (!normalizedCategory) {
    return QUOTE_API_BASE;
  }
  const params = new URLSearchParams({ c: normalizedCategory });
  return `${QUOTE_API_BASE}?${params}`;
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function resolveWeatherLocation(settings) {
  if (settings.locationMode === "manual") {
    return normalizeLocation(settings.manualLocation) || FALLBACK_LOCATION;
  }

  if (!("geolocation" in navigator)) {
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

  return formatReverseLocationLabel(data);
}

async function searchLocations(query) {
  const params = new URLSearchParams({
    q: query
  });
  let data;
  try {
    data = await fetchJsonWithTimeout(`${LOCATION_SEARCH_API}?${params}`, 4000);
  } catch (_error) {
    data = await fetchJsonWithTimeout(buildDirectLocationSearchUrl(query), 4000);
  }
  const results = Array.isArray(data?.results) ? data.results : [];

  return results
    .map((item) => ({
      label: formatGeocodingLocationLabel(item),
      latitude: Number(item.latitude),
      longitude: Number(item.longitude),
      source: "manual",
      precision: resolveGeocodingPrecision(item)
    }))
    .filter(
      (item) =>
        item.label &&
        item.precision === "district" &&
        isFiniteCoordinate(item)
    );
}

function buildDirectLocationSearchUrl(query) {
  const params = new URLSearchParams({
    name: query,
    count: "8",
    language: "zh",
    countryCode: "CN",
    format: "json"
  });
  return `${GEOCODING_API_BASE}?${params}`;
}

function formatReverseLocationLabel(data) {
  const city = cleanLocationPart(data?.city);
  const locality = cleanLocationPart(data?.locality);
  const district = resolveReverseDistrict(data);
  const principalSubdivision = cleanLocationPart(data?.principalSubdivision);
  const countryName = cleanLocationPart(data?.countryName);

  if (city && district && city !== district) {
    return `${city}${district}`;
  }
  if (principalSubdivision && district && principalSubdivision !== district) {
    return `${principalSubdivision}${district}`;
  }
  if (city && locality && city !== locality) {
    return `${city}${locality}`;
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

function formatGeocodingLocationLabel(item) {
  const district = cleanLocationPart(item?.admin3 || item?.admin2 || item?.name);
  const city = cleanLocationPart(item?.admin2 || item?.admin1);
  const province = cleanLocationPart(item?.admin1);
  const parts = [
    district,
    city !== district ? city : "",
    province !== city && province !== district ? province : ""
  ].filter(Boolean);
  return Array.from(new Set(parts)).join(" · ");
}

function resolveReverseDistrict(data) {
  const administrative = Array.isArray(data?.localityInfo?.administrative)
    ? data.localityInfo.administrative
    : [];
  const districtLike = administrative.find((item) =>
    /区|县|旗|市辖区|district|county/i.test(String(item?.name || ""))
  );

  return (
    cleanLocationPart(districtLike?.name) ||
    cleanLocationPart(data?.locality) ||
    cleanLocationPart(administrative[3]?.name)
  );
}

function resolveGeocodingPrecision(item) {
  const candidate = `${item?.name || ""}${item?.admin2 || ""}${item?.admin3 || ""}`;
  return /区|县|旗/.test(candidate) ? "district" : "city";
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

function randomLocalQuote(settings, previousQuote) {
  const filter = randomQuoteFilter(settings);
  const sourceFilter = filter?.source ? [filter.source] : [];
  const candidates = sourceFilter.length
    ? LOCAL_QUOTES.filter((quote) => quoteMatchesSources(quote.source, sourceFilter))
    : LOCAL_QUOTES;
  const pool = candidates.length ? candidates : LOCAL_QUOTES;
  const nonRepeatingPool = pool.filter(
    (quote) => !isSameQuoteText(quote.text, previousQuote)
  );
  const finalPool = nonRepeatingPool.length ? nonRepeatingPool : pool;
  const quote = finalPool[Math.floor(Math.random() * finalPool.length)];
  return { text: quote.text, source: quote.source };
}

function randomQuoteFilter(settings) {
  const filters = normalizeQuoteFilters(settings);
  if (!filters.length) {
    return null;
  }
  return filters[Math.floor(Math.random() * filters.length)];
}

function isSameQuoteText(text, previousQuote) {
  return normalizeQuoteText(text) === normalizeQuoteText(previousQuote?.text);
}

function normalizeQuoteText(text) {
  return String(text || "")
    .replace(/\s+/g, "")
    .trim();
}

function normalizeQuoteSources(sources) {
  if (!Array.isArray(sources)) {
    return [];
  }
  return Array.from(new Set(sources.map(cleanQuoteSource).filter(Boolean)));
}

function cleanQuoteSource(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 36);
}

function isSameQuoteSource(a, b) {
  return normalizeQuoteSourceForMatch(a) === normalizeQuoteSourceForMatch(b);
}

function normalizeQuoteFilters(settingsOrFilters) {
  const rawFilters = Array.isArray(settingsOrFilters)
    ? settingsOrFilters
    : settingsOrFilters?.quoteFilters;

  if (Array.isArray(rawFilters)) {
    const normalized = rawFilters
      .map((item) => ({
        source: cleanQuoteSource(item?.source),
        category: normalizeQuoteCategory(item?.category) || DEFAULT_QUOTE_CATEGORY
      }))
      .filter((item) => item.source);

    return dedupeQuoteFilters(normalized);
  }

  return migrateQuoteFilters(settingsOrFilters);
}

function migrateQuoteFilters(settings) {
  const sources = normalizeQuoteSources(settings?.quoteSources);
  const categories = normalizeQuoteCategories(settings?.quoteCategories);
  const fallbackCategory = categories[0] || DEFAULT_QUOTE_CATEGORY;

  return sources.map((source, index) => ({
    source,
    category: categories[index] || fallbackCategory
  }));
}

function dedupeQuoteFilters(filters) {
  const seen = new Set();
  const result = [];

  filters.forEach((filter) => {
    const key = normalizeQuoteSourceForMatch(filter.source);
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(filter);
  });

  return result;
}

function quoteMatchesSources(from, filters) {
  const normalizedFilters = normalizeQuoteSources(filters);
  if (!normalizedFilters.length) {
    return true;
  }

  const source = normalizeQuoteSourceForMatch(from);
  if (!source) {
    return false;
  }

  return normalizedFilters.some((filter) => {
    const needle = normalizeQuoteSourceForMatch(filter);
    return source.includes(needle) || needle.includes(source);
  });
}

function normalizeQuoteSourceForMatch(value) {
  return String(value || "")
    .replace(/[：:]/g, "")
    .replace(/\s+/g, "")
    .toLocaleLowerCase();
}

function normalizeQuoteCategories(categories) {
  if (!Array.isArray(categories)) {
    return [];
  }

  const validCodes = new Set(HITOKOTO_CATEGORIES.map((category) => category.code));
  return Array.from(
    new Set(categories.map((code) => String(code || "").trim()).filter((code) =>
      validCodes.has(code)
    ))
  );
}

function normalizeQuoteCategory(category) {
  const code = String(category || "").trim();
  return HITOKOTO_CATEGORIES.some((item) => item.code === code) ? code : "";
}

function formatQuoteSource(quote) {
  return `—— ${quote?.source || "每日一言"}`;
}

function readStoredSettings() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(raw);
    const migratedMode =
      parsed.locationMode === "manual" || parsed.locationMode === "browser"
        ? parsed.locationMode
        : parsed.useBrowserLocation === false
          ? "manual"
          : DEFAULT_SETTINGS.locationMode;

    return {
      ...DEFAULT_SETTINGS,
      locationMode: migratedMode,
      manualLocation:
        normalizeLocation(parsed.manualLocation) || DEFAULT_SETTINGS.manualLocation,
      pageScale: normalizePageScale(parsed.pageScale),
      quoteRefreshMinutes: normalizeQuoteRefreshMinutes(
        parsed.quoteRefreshMinutes
      ),
      quoteFilters: normalizeQuoteFilters(parsed).length
        ? normalizeQuoteFilters(parsed)
        : DEFAULT_SETTINGS.quoteFilters
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

function normalizePageScale(value) {
  const scale = Number(value);
  if (!Number.isFinite(scale)) {
    return DEFAULT_SETTINGS.pageScale;
  }
  const bounded = Math.min(MAX_PAGE_SCALE, Math.max(MIN_PAGE_SCALE, scale));
  return Math.round(bounded / PAGE_SCALE_STEP) * PAGE_SCALE_STEP;
}

function normalizeQuoteRefreshMinutes(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) {
    return DEFAULT_SETTINGS.quoteRefreshMinutes;
  }
  return Math.min(
    MAX_QUOTE_REFRESH_MINUTES,
    Math.max(MIN_QUOTE_REFRESH_MINUTES, Math.round(minutes))
  );
}

function normalizeLocation(location) {
  if (!location) {
    return null;
  }
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  const label = String(location.label || "").trim();

  if (!label || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    label,
    latitude,
    longitude,
    source: location.source || "manual"
  };
}

function isFiniteCoordinate(location) {
  return Number.isFinite(location.latitude) && Number.isFinite(location.longitude);
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
