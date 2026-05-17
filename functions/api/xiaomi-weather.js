const XIAOMI_WEATHER_API =
  "https://weatherapi.market.xiaomi.com/wtr-v3/weather/all";
const XIAOMI_APP_KEY = "weather20151024";
const XIAOMI_SIGN = "zUFJoAR2ZVrDy1vF3D07";

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const latitude = String(url.searchParams.get("latitude") || "").trim();
  const longitude = String(url.searchParams.get("longitude") || "").trim();
  const locationKey = String(url.searchParams.get("locationKey") || "").trim();

  if (
    !locationKey &&
    (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude)))
  ) {
    return json({ current: null }, 400, 60);
  }

  try {
    const params = new URLSearchParams({
      days: "1",
      appKey: XIAOMI_APP_KEY,
      sign: XIAOMI_SIGN,
      isGlobal: "false",
      locale: "zh_cn",
      ts: String(Math.floor(Date.now() / 1000))
    });

    if (locationKey) {
      params.set("locationKey", locationKey);
    }
    if (Number.isFinite(Number(latitude))) {
      params.set("latitude", latitude);
    }
    if (Number.isFinite(Number(longitude))) {
      params.set("longitude", longitude);
    }

    const response = await fetch(`${XIAOMI_WEATHER_API}?${params}`, {
      headers: {
        "User-Agent": "wallpaper-cloudflare-pages"
      }
    });

    if (!response.ok) {
      throw new Error(`Xiaomi weather returned ${response.status}`);
    }

    const payload = await response.json();
    return json(payload, 200, 300);
  } catch (_error) {
    return json({ current: null }, 502, 60);
  }
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

function json(body, status = 200, maxAge = 300) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(),
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${maxAge}`
    }
  });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type"
  };
}
