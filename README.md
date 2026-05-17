# Wallpaper

一个可以部署到 Cloudflare Pages 的 React/Vite 全屏壁纸时钟。

## 本地开发

```bash
pnpm install
pnpm dev
```

## 生产构建

```bash
pnpm build
```

构建产物会输出到 `dist/`。

## Cloudflare Pages

在 Cloudflare Pages 中连接仓库后使用下面的设置：

- Framework preset: `Vite`
- Build command: `pnpm build`
- Build output directory: `dist`
- Node.js version: `20`

也可以用 Wrangler 直接上传：

```bash
pnpm build
pnpm dlx wrangler pages deploy dist --project-name wallpaper
```
