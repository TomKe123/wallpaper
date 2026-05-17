const GEOCODING_API_BASE = "https://geocoding-api.open-meteo.com/v1/search";

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const query = String(url.searchParams.get("q") || "").trim();

  if (query.length < 2) {
    return json({ results: [] });
  }

  try {
    const params = new URLSearchParams({
      name: query,
      count: "8",
      language: "zh",
      countryCode: "CN",
      format: "json"
    });
    const response = await fetch(`${GEOCODING_API_BASE}?${params}`, {
      headers: {
        "User-Agent": "wallpaper-cloudflare-pages"
      }
    });

    if (!response.ok) {
      throw new Error(`Open-Meteo returned ${response.status}`);
    }

    const payload = await response.json();
    const results = Array.isArray(payload?.results) ? payload.results : [];

    return json({
      results: results
        .filter((item) => isChinaDistrictResult(item))
        .map((item) => ({
          name: item.name || "",
          admin1: item.admin1 || "",
          admin2: item.admin2 || "",
          admin3: item.admin3 || "",
          country: item.country || "中国",
          country_code: item.country_code || "CN",
          latitude: item.latitude,
          longitude: item.longitude
        }))
    });
  } catch (_error) {
    return json({ results: [] }, 502);
  }
}

function isChinaDistrictResult(item) {
  const countryCode = String(item.country_code || "").toUpperCase();
  const country = String(item.country || "");
  const nameParts = `${item.name || ""}${item.admin2 || ""}${item.admin3 || ""}`;

  return (
    (countryCode === "CN" || country === "中国" || country === "China") &&
    /区|县|旗/.test(nameParts)
  );
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
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
