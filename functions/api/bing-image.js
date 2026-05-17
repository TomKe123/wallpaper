const BING_ARCHIVE_API =
  "https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN";
const FALLBACK_IMAGE =
  "https://bing.biturl.top/?resolution=1920&format=image&index=0&mkt=zh-CN";

export async function onRequestGet() {
  try {
    const response = await fetch(BING_ARCHIVE_API, {
      headers: {
        "User-Agent": "wallpaper-cloudflare-pages"
      }
    });

    if (!response.ok) {
      throw new Error(`Bing returned ${response.status}`);
    }

    const payload = await response.json();
    const image = payload?.images?.[0];
    const url = resolveBingImageUrl(image);

    if (!url) {
      throw new Error("Bing image URL is empty");
    }

    return json({
      url,
      copyright: image?.copyright || "",
      fallback: false
    });
  } catch (_error) {
    return json({
      url: FALLBACK_IMAGE,
      copyright: "",
      fallback: true
    });
  }
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

function resolveBingImageUrl(image) {
  if (!image) {
    return "";
  }

  if (image.urlbase) {
    return `https://www.bing.com${image.urlbase}_1920x1080.jpg`;
  }

  if (image.url) {
    return image.url.startsWith("http")
      ? image.url
      : `https://www.bing.com${image.url}`;
  }

  return "";
}

function json(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      ...corsHeaders(),
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=1800"
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
