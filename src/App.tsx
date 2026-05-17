import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  FormEvent,
  KeyboardEvent,
  ReactNode
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Cascader, Select } from "antd";
import type { CascaderProps } from "antd";
import areaData from "china-area-data/data.json";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Cloud,
  CloudRain,
  CloudSnow,
  MapPin,
  Plus,
  RefreshCw,
  Sun,
  Trash2,
  ZoomIn,
  X
} from "lucide-react";
import "antd/dist/reset.css";

type LocationMode = "browser" | "manual";
type WeatherStatus = "loading" | "ready" | "error";
type WeatherIconName = "clear" | "cloudy" | "rain" | "snow";

interface WeatherLocation {
  label: string;
  latitude: number;
  locationKey?: string;
  longitude: number;
  source: string;
}

interface WeatherState {
  temp: number | null;
  code: number;
  status: WeatherStatus;
}

interface Quote {
  text: string;
  source: string;
}

interface QuoteFilter {
  source: string;
  category: string;
}

interface AppSettings {
  locationMode: LocationMode;
  manualLocation: WeatherLocation;
  pageScale: number;
  quoteRefreshMinutes: number;
  quoteFilters: QuoteFilter[];
}

interface HitokotoCategory {
  code: string;
  label: string;
}

interface AddressOption {
  value: string;
  label: string;
  children?: AddressOption[];
}

interface AddressSelection {
  label: string;
  parts: string[];
  queries: string[];
}

interface XiaomiLocationCandidate extends WeatherLocation {
  affiliation: string;
  key: string;
  locationKey: string;
  name: string;
}

interface XiaomiWeatherResponse {
  current?: unknown;
}

interface TimeParts {
  hours: string;
  minutes: string;
  seconds: string;
}

interface IconButtonProps {
  children: ReactNode;
  className?: string;
  label: string;
  onClick: () => void;
  spin?: boolean;
  title?: string;
}

interface MotionButtonProps {
  ariaLabel?: string;
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}

interface DigitGroupProps {
  value: string;
  firstMax: number;
}

interface RollingDigitProps {
  value: number;
  max: number;
}

interface WeatherIconProps {
  code: number;
  status: WeatherStatus;
}

type WallpaperStyle = CSSProperties & {
  "--page-scale": number;
  "--wallpaper-image": string;
};

type AreaDataMap = Record<string, Record<string, string>>;

const XIAOMI_LOCATION_API = "/api/xiaomi-location";
const XIAOMI_WEATHER_API = "/api/xiaomi-weather";
const QUOTE_API_BASE = "https://v1.hitokoto.cn";
const DEFAULT_BACKGROUND =
  "https://www.bing.com/th?id=OHR.SpaceTrails_ZH-CN8377463217_1920x1080.jpg";
const FALLBACK_BACKGROUND =
  "https://bing.biturl.top/?resolution=1920&format=image&index=0&mkt=zh-CN";
const FALLBACK_LOCATION: WeatherLocation = {
  label: "上海市宝山区",
  latitude: 31.4053,
  locationKey: "weathercn:101020300",
  longitude: 121.4894,
  source: "fallback"
};
const GEOLOCATION_OPTIONS: PositionOptions = {
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
const DEFAULT_QUOTE_FILTERS: QuoteFilter[] = [
  { source: "原神", category: DEFAULT_QUOTE_CATEGORY },
  { source: "崩坏：星穹铁道", category: DEFAULT_QUOTE_CATEGORY },
  { source: "崩坏3", category: DEFAULT_QUOTE_CATEGORY }
];
const DEFAULT_SETTINGS: AppSettings = {
  locationMode: "browser",
  manualLocation: FALLBACK_LOCATION,
  pageScale: 0.75,
  quoteRefreshMinutes: 5,
  quoteFilters: DEFAULT_QUOTE_FILTERS
};
const MAX_QUOTE_FETCH_ATTEMPTS = 8;
const QUOTE_RETRY_DELAY_MS = 250;
const QUOTE_API_TIMEOUT_MS = 1800;
const HITOKOTO_CATEGORIES: HitokotoCategory[] = [
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
const CHINA_AREA_DATA = areaData as AreaDataMap;
const HITOKOTO_CATEGORY_OPTIONS = HITOKOTO_CATEGORIES.map((category) => ({
  label: category.label,
  value: category.code
}));
const ADDRESS_ROOT_CODE = "86";
const GENERIC_ADDRESS_LABELS = new Set(["市辖区", "县", "省直辖县级行政区划"]);
const ADDRESS_OPTIONS = buildAddressOptions();

const LOCAL_QUOTES: Quote[] = [
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

const WEEKDAYS: string[] = [
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
  const [weather, setWeather] = useState<WeatherState>({
    temp: null,
    code: 0,
    status: "loading"
  });
  const [location, setLocation] = useState<WeatherLocation>(FALLBACK_LOCATION);
  const [quote, setQuote] = useState(() => randomLocalQuote(DEFAULT_SETTINGS));
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => readStoredSettings());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const quoteRef = useRef(quote);
  const dateTapCountRef = useRef(0);
  const dateTapTimerRef = useRef<number | undefined>(undefined);

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
    let nextLocation: WeatherLocation | null = null;

    try {
      nextLocation = await resolveWeatherLocation(settings);
      setLocation(nextLocation);

      const data = await fetchJsonWithTimeout<XiaomiWeatherResponse>(
        buildXiaomiWeatherApiUrl(nextLocation),
        3000
      );
      const current = asRecord(data.current);
      const temperature = Number(asRecord(current.temperature).value);

      if (!Number.isFinite(temperature)) {
        throw new Error("missing weather");
      }

      setWeather({
        temp: Math.round(temperature),
        code: Number(current.weather || 0),
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
      const data = await fetchJsonWithTimeout<{ url?: unknown }>(
        "/api/bing-image",
        3000
      );
      const url = String(data?.url || "").trim();
      setBackgroundUrl(url || FALLBACK_BACKGROUND);
    } catch (_error) {
      setBackgroundUrl(FALLBACK_BACKGROUND);
    }
  }, []);

  useEffect(() => {
    let timerId: number | undefined;

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
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      handleDateBarClick();
    },
    [handleDateBarClick]
  );

  const handleLocationModeChange = useCallback((mode: LocationMode) => {
    setSettings((previous) => ({
      ...previous,
      locationMode: mode
    }));
  }, []);

  const handleManualLocationChange = useCallback((manualLocation: WeatherLocation) => {
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

  const handlePageScaleChange = useCallback((pageScale: number | string) => {
    setSettings((previous) => ({
      ...previous,
      pageScale: normalizePageScale(pageScale)
    }));
  }, []);

  const handleQuoteRefreshMinutesChange = useCallback((minutes: number | string) => {
    setSettings((previous) => ({
      ...previous,
      quoteRefreshMinutes: normalizeQuoteRefreshMinutes(minutes)
    }));
  }, []);

  const handleAddQuoteFilter = useCallback((source: string, category: string) => {
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

  const handleRemoveQuoteFilter = useCallback((source: string) => {
    setSettings((previous) => ({
      ...previous,
      quoteFilters: normalizeQuoteFilters(previous).filter(
        (item) => !isSameQuoteSource(item.source, source)
      )
    }));
  }, []);

  const handleQuoteFilterCategoryChange = useCallback((source: string, category: string) => {
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
  const wallpaperStyle: WallpaperStyle = {
    "--page-scale": settings.pageScale,
    "--wallpaper-image": `url("${escapeCssUrl(backgroundUrl)}")`
  };

  return (
    <main
      className="wallpaper"
      style={wallpaperStyle}
    >
      <motion.section
        className="clock-container"
        aria-label="滚动时钟壁纸"
        initial={shouldReduceMotion ? false : { opacity: 0 }}
        animate={shouldReduceMotion ? undefined : { opacity: 1 }}
        transition={
          shouldReduceMotion
            ? undefined
            : { duration: 0.65, ease: [0.22, 1, 0.36, 1] }
        }
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

interface SettingsDialogProps {
  location: WeatherLocation;
  onAddQuoteFilter: (source: string, category: string) => void;
  onLocationModeChange: (mode: LocationMode) => void;
  onManualLocationChange: (location: WeatherLocation) => void;
  onOpenChange: (open: boolean) => void;
  onPageScaleChange: (pageScale: number | string) => void;
  onQuoteFilterCategoryChange: (source: string, category: string) => void;
  onQuoteRefreshMinutesChange: (minutes: number | string) => void;
  onRefreshBackground: () => void;
  onRefreshQuote: () => void;
  onRefreshWeather: () => void;
  onRemoveQuoteFilter: (source: string) => void;
  open: boolean;
  settings: AppSettings;
  weatherStatus: WeatherStatus;
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
}: SettingsDialogProps) {
  const shouldReduceMotion = useReducedMotion();
  const pageScale = normalizePageScale(settings.pageScale);
  const pageScalePercent = Math.round(pageScale * 100);
  const quoteRefreshMinutes = normalizeQuoteRefreshMinutes(
    settings.quoteRefreshMinutes
  );
  const quoteFilters = normalizeQuoteFilters(settings);
  const [sourceInput, setSourceInput] = useState("");
  const [sourceCategory, setSourceCategory] = useState(DEFAULT_QUOTE_CATEGORY);
  const [locationSearchError, setLocationSearchError] = useState("");
  const [isLocationResolving, setIsLocationResolving] = useState(false);
  const [pageScaleInput, setPageScaleInput] = useState(String(pageScalePercent));

  useEffect(() => {
    if (!open) {
      setSourceInput("");
      setSourceCategory(DEFAULT_QUOTE_CATEGORY);
      setLocationSearchError("");
      setIsLocationResolving(false);
    }
  }, [open]);

  useEffect(() => {
    setPageScaleInput(String(pageScalePercent));
  }, [pageScalePercent]);

  const handleAddressChange: CascaderProps<AddressOption, "value">["onChange"] = async (
    _value,
    selectedOptions
  ) => {
    const selection = formatAddressSelection(selectedOptions);
    if (!selection) {
      return;
    }

    setIsLocationResolving(true);
    setLocationSearchError("");

    try {
      const result = await resolveAddressLocation(selection);
      if (!result) {
        setLocationSearchError("没有找到该区县的天气位置");
        return;
      }
      onManualLocationChange(result);
    } catch (_error) {
      setLocationSearchError("地点解析暂不可用");
    } finally {
      setIsLocationResolving(false);
    }
  };

  const handlePageScaleInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
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

  const handlePageScaleInputKeyDown = (
    event: KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitPageScaleInput();
    }
  };

  const handleSourceSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onAddQuoteFilter(sourceInput, sourceCategory);
    setSourceInput("");
  };

  const handleDialogInteractOutside = (event: Event) => {
    if (isAddressCascaderPopupTarget(event.target)) {
      event.preventDefault();
    }
  };

  return (
    <Dialog.Root modal={false} open={open} onOpenChange={onOpenChange}>
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
            <Dialog.Content
              asChild
              forceMount
              onInteractOutside={handleDialogInteractOutside}
            >
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
                      <Select
                        aria-label="新来源分类"
                        className="settings-select"
                        options={HITOKOTO_CATEGORY_OPTIONS}
                        popupClassName="quote-category-select-popup"
                        value={sourceCategory}
                        onChange={setSourceCategory}
                      />
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
                            <Select
                              aria-label={`${filter.source} 分类`}
                              className="source-chip-select"
                              options={HITOKOTO_CATEGORY_OPTIONS}
                              popupClassName="quote-category-select-popup"
                              value={filter.category}
                              onChange={(category) =>
                                onQuoteFilterCategoryChange(
                                  filter.source,
                                  category
                                )
                              }
                            />
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

                    <Cascader<AddressOption, "value">
                      className="address-cascader"
                      disabled={isLocationResolving}
                      options={ADDRESS_OPTIONS}
                      onChange={handleAddressChange}
                      placeholder={
                        isLocationResolving ? "正在解析天气位置" : "选择省 / 市 / 区县"
                      }
                      showSearch
                      changeOnSelect={false}
                      allowClear
                      placement="bottomLeft"
                      aria-label="手动选择天气位置"
                      popupClassName="address-cascader-popup"
                      displayRender={(labels) =>
                        labels.filter((label) => !GENERIC_ADDRESS_LABELS.has(label)).join(" / ")
                      }
                      status={locationSearchError ? "error" : undefined}
                    />

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
                  </section>

                  <div className="settings-row">
                    <span className="settings-copy">
                      <span className="settings-label">
                        <Cloud aria-hidden="true" />
                        天气数据
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

function IconButton({
  children,
  className,
  label,
  onClick,
  spin,
  title
}: IconButtonProps) {
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

function MotionButton({
  ariaLabel,
  children,
  disabled,
  onClick
}: MotionButtonProps) {
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

function DigitGroup({ value, firstMax }: DigitGroupProps) {
  return (
    <div className="digit-group" aria-hidden="true">
      <RollingDigit value={Number(value[0])} max={firstMax} />
      <RollingDigit value={Number(value[1])} max={9} />
    </div>
  );
}

function RollingDigit({ value, max }: RollingDigitProps) {
  const previousRef = useRef(value);
  const resetTimerRef = useRef<number | undefined>(undefined);
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

  const digits: number[] = [];
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

function WeatherIcon({ code, status }: WeatherIconProps) {
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

async function fetchJsonWithTimeout<T = unknown>(
  url: string,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function fetchFilteredQuote(
  settings: AppSettings,
  previousQuote?: Quote
): Promise<Quote> {
  const filter = randomQuoteFilter(settings);
  const apiUrl = buildQuoteApiUrl(filter?.category);
  const sourceFilter = filter?.source ? [filter.source] : [];

  for (let i = 0; i < MAX_QUOTE_FETCH_ATTEMPTS; i += 1) {
    try {
      const data = await fetchJsonWithTimeout<Record<string, unknown>>(
        apiUrl,
        QUOTE_API_TIMEOUT_MS
      );
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

function buildQuoteApiUrl(category?: string): string {
  const normalizedCategory = normalizeQuoteCategory(category);
  if (!normalizedCategory) {
    return QUOTE_API_BASE;
  }
  const params = new URLSearchParams({ c: normalizedCategory });
  return `${QUOTE_API_BASE}?${params}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function buildAddressOptions(parentCode = ADDRESS_ROOT_CODE): AddressOption[] {
  return Object.entries(CHINA_AREA_DATA[parentCode] || {}).map(([value, label]) => {
    const children = buildAddressOptions(value);
    return {
      value,
      label,
      ...(children.length ? { children } : {})
    };
  });
}

function formatAddressSelection(options: AddressOption[]): AddressSelection | null {
  const parts = options
    .map((option) => cleanLocationPart(option.label))
    .filter((part) => part && !GENERIC_ADDRESS_LABELS.has(part));

  if (!parts.length) {
    return null;
  }

  return {
    parts,
    label: parts.join(""),
    queries: buildAddressQueries(parts)
  };
}

function buildAddressQueries(parts: string[]): string[] {
  return Array.from(
    new Set([
      parts.join(""),
      parts.slice(-2).join(""),
      parts[parts.length - 1] || ""
    ].filter((query) => query.length >= 2))
  );
}

async function resolveAddressLocation(
  selection: AddressSelection
): Promise<WeatherLocation | null> {
  let bestMatch: XiaomiLocationCandidate | null = null;
  let bestScore = -1;
  let lastError: unknown = null;

  for (const query of selection.queries) {
    try {
      const results = await searchXiaomiLocations(query);
      for (const result of results) {
        const score = scoreAddressResult(result, selection.parts);
        if (score > bestScore) {
          bestMatch = result;
          bestScore = score;
        }
      }

      if (bestMatch && bestScore >= Math.max(4, selection.parts.length * 2)) {
        break;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (!bestMatch && lastError) {
    throw lastError;
  }

  return bestMatch
    ? {
        label: selection.label,
        latitude: bestMatch.latitude,
        locationKey: bestMatch.locationKey,
        longitude: bestMatch.longitude,
        source: "manual"
      }
    : null;
}

function scoreAddressResult(result: XiaomiLocationCandidate, parts: string[]): number {
  const label = normalizeAddressSearchText(
    `${result.name}${result.affiliation}${result.label}`
  );
  const normalizedParts = parts.map(normalizeAddressSearchText).filter(Boolean);
  let score = 0;

  normalizedParts.forEach((part, index) => {
    if (!label.includes(part)) {
      return;
    }
    score += index === normalizedParts.length - 1 ? 4 : 2;
  });

  const district = normalizedParts[normalizedParts.length - 1];
  if (district && label.startsWith(district)) {
    score += 2;
  }

  return score;
}

function normalizeAddressSearchText(value: string): string {
  return cleanLocationPart(value).replace(/[·/]/g, "");
}

function isAddressCascaderPopupTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(".address-cascader-popup, .quote-category-select-popup")
    )
  );
}

async function resolveWeatherLocation(settings: AppSettings): Promise<WeatherLocation> {
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

    const currentLocation = await resolveXiaomiGeoLocation(latitude, longitude);
    if (currentLocation) {
      return currentLocation;
    }

    return {
      label: "当前位置",
      latitude,
      longitude,
      source: "client"
    };
  } catch (_error) {
    return FALLBACK_LOCATION;
  }
}

function getCurrentPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

async function resolveXiaomiGeoLocation(
  latitude: number,
  longitude: number
): Promise<WeatherLocation | null> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude)
  });
  const data = await fetchJsonWithTimeout<{ results?: unknown[] }>(
    `${XIAOMI_LOCATION_API}?${params}`,
    4000
  );
  const candidates = parseXiaomiLocationCandidates(data.results);
  const candidate = candidates[0];

  return candidate
    ? {
        label: candidate.label || candidate.name || "当前位置",
        latitude: candidate.latitude,
        locationKey: candidate.locationKey,
        longitude: candidate.longitude,
        source: "client"
      }
    : null;
}

async function searchXiaomiLocations(query: string): Promise<XiaomiLocationCandidate[]> {
  const params = new URLSearchParams({
    q: query
  });
  const data = await fetchJsonWithTimeout<{ results?: unknown[] }>(
    `${XIAOMI_LOCATION_API}?${params}`,
    4000
  );
  return parseXiaomiLocationCandidates(data.results);
}

function parseXiaomiLocationCandidates(results: unknown): XiaomiLocationCandidate[] {
  return (Array.isArray(results) ? results : [])
    .map((item) => {
      const record = asRecord(item);
      const locationKey = String(record.locationKey || record.key || "").trim();
      const latitude = Number(record.latitude);
      const longitude = Number(record.longitude);
      const name = cleanLocationPart(record.name);
      const affiliation = cleanLocationPart(record.affiliation);
      const label = formatXiaomiLocationLabel(name, affiliation);
      return {
        affiliation,
        key: String(record.key || locationKey),
        label,
        latitude,
        locationKey,
        longitude,
        name,
        source: "manual"
      };
    })
    .filter(
      (item) =>
        item.locationKey &&
        item.label &&
        isFiniteCoordinate(item)
    );
}

function formatXiaomiLocationLabel(name: string, affiliation: string): string {
  const affiliationParts = affiliation
    .split(/[，,]/)
    .map(cleanLocationPart)
    .filter((part) => part && part !== "中国");
  const parts = [...affiliationParts, name].filter(Boolean);
  return Array.from(new Set(parts)).join("");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function cleanLocationPart(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, "")
    .trim();
}

function buildXiaomiWeatherApiUrl(location: WeatherLocation): string {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude)
  });
  if (location.locationKey) {
    params.set("locationKey", location.locationKey);
  }
  return `${XIAOMI_WEATHER_API}?${params}`;
}

function randomLocalQuote(settings: AppSettings, previousQuote?: Quote): Quote {
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

function randomQuoteFilter(settings: AppSettings): QuoteFilter | null {
  const filters = normalizeQuoteFilters(settings);
  if (!filters.length) {
    return null;
  }
  return filters[Math.floor(Math.random() * filters.length)];
}

function isSameQuoteText(text: string, previousQuote?: Quote): boolean {
  return normalizeQuoteText(text) === normalizeQuoteText(previousQuote?.text);
}

function normalizeQuoteText(text: unknown): string {
  return String(text || "")
    .replace(/\s+/g, "")
    .trim();
}

function normalizeQuoteSources(sources: unknown): string[] {
  if (!Array.isArray(sources)) {
    return [];
  }
  return Array.from(new Set(sources.map(cleanQuoteSource).filter(Boolean)));
}

function cleanQuoteSource(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 36);
}

function isSameQuoteSource(a: unknown, b: unknown): boolean {
  return normalizeQuoteSourceForMatch(a) === normalizeQuoteSourceForMatch(b);
}

function normalizeQuoteFilters(settingsOrFilters: unknown): QuoteFilter[] {
  const rawFilters = Array.isArray(settingsOrFilters)
    ? settingsOrFilters
    : asRecord(settingsOrFilters).quoteFilters;

  if (Array.isArray(rawFilters)) {
    const normalized = rawFilters
      .map((item) => {
        const record = asRecord(item);
        return {
        source: cleanQuoteSource(record.source),
        category: normalizeQuoteCategory(record.category) || DEFAULT_QUOTE_CATEGORY
      };
      })
      .filter((item): item is QuoteFilter => Boolean(item.source));

    return dedupeQuoteFilters(normalized);
  }

  return migrateQuoteFilters(asRecord(settingsOrFilters));
}

function migrateQuoteFilters(settings: Record<string, unknown>): QuoteFilter[] {
  const sources = normalizeQuoteSources(settings.quoteSources);
  const categories = normalizeQuoteCategories(settings.quoteCategories);
  const fallbackCategory = categories[0] || DEFAULT_QUOTE_CATEGORY;

  return sources.map((source, index) => ({
    source,
    category: categories[index] || fallbackCategory
  }));
}

function dedupeQuoteFilters(filters: QuoteFilter[]): QuoteFilter[] {
  const seen = new Set<string>();
  const result: QuoteFilter[] = [];

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

function quoteMatchesSources(from: unknown, filters: unknown): boolean {
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

function normalizeQuoteSourceForMatch(value: unknown): string {
  return String(value || "")
    .replace(/[：:]/g, "")
    .replace(/\s+/g, "")
    .toLocaleLowerCase();
}

function normalizeQuoteCategories(categories: unknown): string[] {
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

function normalizeQuoteCategory(category: unknown): string {
  const code = String(category || "").trim();
  return HITOKOTO_CATEGORIES.some((item) => item.code === code) ? code : "";
}

function formatQuoteSource(quote: Quote): string {
  return `—— ${quote?.source || "每日一言"}`;
}

function readStoredSettings(): AppSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }
    const parsed = asRecord(JSON.parse(raw));
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

function writeStoredSettings(settings: AppSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (_error) {
    // Local storage can be unavailable in hardened browser contexts.
  }
}

function normalizePageScale(value: unknown): number {
  const scale = Number(value);
  if (!Number.isFinite(scale)) {
    return DEFAULT_SETTINGS.pageScale;
  }
  const bounded = Math.min(MAX_PAGE_SCALE, Math.max(MIN_PAGE_SCALE, scale));
  return Math.round(bounded / PAGE_SCALE_STEP) * PAGE_SCALE_STEP;
}

function normalizeQuoteRefreshMinutes(value: unknown): number {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) {
    return DEFAULT_SETTINGS.quoteRefreshMinutes;
  }
  return Math.min(
    MAX_QUOTE_REFRESH_MINUTES,
    Math.max(MIN_QUOTE_REFRESH_MINUTES, Math.round(minutes))
  );
}

function normalizeLocation(location: unknown): WeatherLocation | null {
  if (!location) {
    return null;
  }
  const record = asRecord(location);
  const latitude = Number(record.latitude);
  const longitude = Number(record.longitude);
  const label = String(record.label || "").trim();

  if (!label || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    label,
    latitude,
    locationKey: String(record.locationKey || "").trim() || undefined,
    longitude,
    source: String(record.source || "manual")
  };
}

function isFiniteCoordinate(location: WeatherLocation): boolean {
  return Number.isFinite(location.latitude) && Number.isFinite(location.longitude);
}

function resolveWeatherStatusText(status: WeatherStatus): string {
  if (status === "ready") {
    return "已更新";
  }
  if (status === "loading") {
    return "更新中";
  }
  return "暂不可用";
}

function getGreeting(hour: number): string {
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

function formatTimeLabel({ hours, minutes, seconds }: TimeParts): string {
  return `${hours}:${minutes}:${seconds}`;
}

function resolveWeatherIcon(code: number, status: WeatherStatus): WeatherIconName {
  if (status === "error") {
    return "cloudy";
  }
  if (code === 7 || code === 8 || code === 22 || code === 23 || code === 24 || code === 25) {
    return "snow";
  }
  if (
    (code >= 3 && code <= 6) ||
    (code >= 9 && code <= 12) ||
    (code >= 19 && code <= 21)
  ) {
    return "rain";
  }
  if (code === 1 || code === 2 || code === 13 || code === 14 || code === 18 || code >= 26) {
    return "cloudy";
  }
  return "clear";
}

function escapeCssUrl(url: string): string {
  return String(url).replace(/["\\]/g, "\\$&");
}

export default App;
