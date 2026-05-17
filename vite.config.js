import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { onRequestGet as getBingImage } from "./functions/api/bing-image.js";
import { onRequestGet as getXiaomiLocation } from "./functions/api/xiaomi-location.js";
import { onRequestGet as getXiaomiWeather } from "./functions/api/xiaomi-weather.js";

function localFunctionMiddleware(route, handler) {
  return {
    name: `local-${route}`,
    configureServer(server) {
      server.middlewares.use(route, async (request, response, next) => {
        if (request.method !== "GET") {
          next();
          return;
        }

        try {
          const origin = `http://${request.headers.host || "127.0.0.1:5173"}`;
          const result = await handler({
            request: new Request(new URL(request.url || route, origin))
          });
          response.statusCode = result.status;
          result.headers.forEach((value, key) => response.setHeader(key, value));
          response.end(await result.text());
        } catch (_error) {
          response.statusCode = 502;
          response.setHeader("content-type", "application/json; charset=utf-8");
          response.end(JSON.stringify({ error: "local function failed" }));
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    localFunctionMiddleware("/api/bing-image", getBingImage),
    localFunctionMiddleware("/api/xiaomi-location", getXiaomiLocation),
    localFunctionMiddleware("/api/xiaomi-weather", getXiaomiWeather)
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true
  },
  server: {
    host: "0.0.0.0",
    port: 5173
  },
  preview: {
    host: "0.0.0.0",
    port: 4173
  }
});
