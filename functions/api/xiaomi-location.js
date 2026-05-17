const XIAOMI_LOCATION_SEARCH_API =
  "https://weatherapi.market.xiaomi.com/wtr-v3/location/city/search";
const XIAOMI_LOCATION_GEO_API =
  "https://weatherapi.market.xiaomi.com/wtr-v3/location/city/geo";

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const query = String(url.searchParams.get("q") || "").trim();
  const latitude = String(url.searchParams.get("latitude") || "").trim();
  const longitude = String(url.searchParams.get("longitude") || "").trim();

  try {
    const upstreamUrl = buildXiaomiLocationUrl(query, latitude, longitude);
    if (!upstreamUrl) {
      return json({ results: [] });
    }

    const response = await fetch(upstreamUrl, {
      headers: {
        "User-Agent": "wallpaper-cloudflare-pages"
      }
    });

    if (!response.ok) {
      throw new Error(`Xiaomi location returned ${response.status}`);
    }

    const payload = await response.json();
    const results = Array.isArray(payload) ? payload : [];

    return json({
      results: results.map(normalizeXiaomiLocation).filter(Boolean)
    });
  } catch (_error) {
    return json({ results: [] }, 502);
  }
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

function buildXiaomiLocationUrl(query, latitude, longitude) {
  const params = new URLSearchParams({
    locale: "zh_cn"
  });

  if (query.length >= 2) {
    params.set("name", query);
    return `${XIAOMI_LOCATION_SEARCH_API}?${params}`;
  }

  if (Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))) {
    params.set("latitude", latitude);
    params.set("longitude", longitude);
    return `${XIAOMI_LOCATION_GEO_API}?${params}`;
  }

  return "";
}

function normalizeXiaomiLocation(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const locationKey = String(item.locationKey || item.key || "").trim();
  const latitude = Number(item.latitude);
  const longitude = Number(item.longitude);

  if (!locationKey || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    affiliation: item.affiliation || "",
    key: item.key || locationKey,
    latitude,
    locationKey,
    longitude,
    name: item.name || "",
    status: item.status ?? 0,
    timeZoneShift: item.timeZoneShift ?? 28800
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(),
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300"
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
