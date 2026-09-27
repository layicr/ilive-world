# 星球小镇 · Planet Town

一座「会唱歌的小星球」——用 Three.js 手绘的 3D 演唱会场景。全站由 **Nuxt 4** 驱动：首页 `/` 即星球小镇，演唱会数据存在 **LibSQL / Turso** 数据库里，通过 `server/api` 供前端读取，支持 **简体中文 / English / 繁體中文** 三语。

## 技术栈

| 领域 | 选型 |
| --- | --- |
| 框架 | Nuxt 4（Vue 3.5，Vue Router 5 由 Nuxt 自带），`app/` srcDir |
| 3D | Three.js **0.128**（npm 依赖，运行时动态 `import('three')` 后挂全局 `window.THREE`，仅首页按需加载） |
| 数据库 | `@libsql/client`（Turso 云 或 本地 `file:./data/planet.db`） |
| 多语言 | `@nuxtjs/i18n` v10，`prefix_except_default` 策略 |
| 类型 | TypeScript strict，构建期 `typeCheck: false` |
| 单测 / E2E | Vitest + @vue/test-utils + happy-dom / Playwright |

## 快速开始

```bash
npm install          # 安装依赖（postinstall 会执行 nuxt prepare）
npm run seed         # 执行 schema.sql 建库 + 幂等写入 60 场演唱会、歌单与标签
npm run dev          # http://localhost:3000
```

开发**零配置可跑**：未设置 Turso 环境变量时，自动落本地文件 `data/planet.db`。

生产：

```bash
npm run build        # 产物在 .output/，含 /、/en/、/zh-Hant/ 预渲染
node .output/server/index.mjs     # 或 npm run preview
```

## 数据库连接与运行配置

复制 `.env.example` 为 `.env`。**不配任何变量即自动用本地文件 `data/planet.db`**，开发零配置可跑。

```bash
# —— 数据库（单变量，本地文件 / Turso 云三选一）——
DATABASE_URL=data/planet.db                     # 本地 SQLite 文件路径（相对项目根，父目录自动创建）
# DATABASE_URL=file:./var/my.db                 # 亦可带 file: 前缀 / 绝对路径
# DATABASE_URL=libsql://<your-db>.turso.io      # 填云地址则连 Turso 云，需配下行
TURSO_AUTH_TOKEN=***                             # 仅 Turso 云模式需要

# —— 域名与部署 ——
NUXT_PUBLIC_SITE_URL=https://your.domain         # canonical/sitemap 兜底域名（库内 site_url 优先）
# NUXT_TRUST_PROXY=true                          # 仅当部署在可信反代/CDN（Nginx、Cloudflare）后才需要，见下

# —— 点赞安全（可选，均有内置默认）——
# NUXT_IP_SALT=your-long-random-secret           # 点赞 IP 哈希盐：concert_likes.ip 存 HMAC-SHA256(盐,IP)，不落明文 IP
# NUXT_RATELIMIT_LIKE_MAX=30                     # 点赞限流窗口内最大次数（0 = 完全关闭点赞；默认 30）
# NUXT_RATELIMIT_LIKE_WINDOW_MS=60000            # 限流窗口毫秒（默认 60000）
```

连接规则：`DATABASE_URL` 为 `libsql://`/`http(s)://` → **Turso 云**；否则视为 **本地文件路径**（可带 `file:` 前缀，相对路径按进程工作目录解析、父目录自动创建）；为空则默认 `data/planet.db`（server 与 `npm run seed` 同规则）。

> canonical 与 og 域名的优先级：库内 `site_settings.site_url` → `NUXT_PUBLIC_SITE_URL` → 请求 host。

> 真实客户端 IP（点赞去重）：默认取不可伪造的 TCP socket 对端地址，**直连部署下安全**；但若部署在 Nginx/Cloudflare 等反代之后，对端地址会变成反代自身的内网 IP，导致所有访客被误判成同一个 IP、点赞互相覆盖。此时需显式设 `NUXT_TRUST_PROXY=true`，服务端才会依次读取 `X-Forwarded-For` / `cf-connecting-ip` / `x-real-ip` 转发头（要求反代**覆写**而非追加，否则客户端可自行伪造）。Vercel 部署无需此开关，会自动优先采用平台注入的 `x-vercel-forwarded-for`。

> `NUXT_IP_SALT` 生产必须设为随机长字符串，且**一旦有用户点过赞就不可再变更**（换盐 = 全部点赞去重失效）。

## 目录结构

```
app/
├─ app.vue                     # 全局 head：titleTemplate / hreflang / canonical / og / twitter / robots
├─ pages/index.vue             # 星球首页（唯一入口：SSR + JSON-LD WebSite + Three.js 3D 场景 + 欢迎卡）
├─ components/
│  ├─ SiteHeader.vue           # 顶部导航（含艺人搜索框入口）
│  ├─ ArtistSearch.vue         # 艺人搜索，点结果 → ?concert=<id> 让镜头转到对应舞台
│  ├─ LocaleSwitcher.vue       # 三语切换（NuxtLink 客户端路由跳转，页面实例被复用）
│  └─ planet/                  # PlanetScene（装配数据/文案）· PlanetCanvas（引擎挂载/暂停/语言切换）· WelcomeCard
├─ composables/                # useConcerts / useSiteConfig / useWelcomeCard
├─ three/
│  ├─ planetTown.ts            # 编排层：createPlanetTown(el, { stageInfos, labels }) → { unmount, pause, resume, setLang, focusConcert }
│  ├─ concert/                 # 演唱会子系统：index（装配 + 每帧更新 + setLang）· card / cardCss · modal · hitTest · marquee · safeLink
│  └─ town/                    # 小镇子系统：village · characters · atmosphere · orbit
├─ assets/css/main.css
└─ error.vue                   # 404/错误页（robots: noindex）
server/
├─ api/concerts.get.ts         # 列表（按 locale 拍平 *_i18n，附歌单 / 标签 / 点赞）
├─ api/concerts/[id].get.ts    # 单场详情
├─ api/concerts/[id]/like.post.ts  # 点赞 toggle（HMAC 去重 + 限流 + 维护 concerts.likes 冗余列）
├─ api/site-config.get.ts      # site_settings + site_seo_i18n（供 SEO 注入）
└─ utils/                      # db（连接回退）· concert-mapper / concert-snapshot（查询与映射）· concertLikes（幂等点赞事务）· rateLimit · i18n-field（*_i18n 拍平/回退）· site-config（内存缓存）
shared/types/concert.ts        # ConcertCard 等前后端共享类型
i18n/locales/                  # zh-CN.json / en.json / zh-Hant.json
public/                        # robots.txt / sitemap.xml / img/og-image.svg
scripts/seed.mjs               # 执行 schema.sql + 幂等写入 60 场演唱会 / 歌单 / 标签
tests/unit  ·  tests/e2e
schema.sql                     # 权威表结构（字段冻结，见下）
```

## 数据库

**以项目根 `schema.sql` 为准，表字段冻结、不可增删改。** 七张表：

- `concerts`：歌手 / 名称 / 主题 / 国家省市 / 场馆 / 座位 / 票价 / 描述 / 视频（均为 `*_i18n`）+ `date` / `time` / `poster` / `seq` / `likes`（冗余总赞数）
- `concert_likes`：点赞明细，`(concert_id, ip)` 唯一去重；`ip` 存 **HMAC-SHA256(盐, IP)** 哈希，不落明文凭据，可取消
- `concert_tags`：每行一个标签，`i18n` 值可为字符串或字符串数组（`parseTags` 两者兼容）
- `concert_songlist`：`concert_id`（外键 `ON DELETE CASCADE`）、歌名 i18n、`link`、`seq`
- `cities`：城市字典（`country_i18n` / `name_i18n` / `icon` emoji / `seq`）
- `site_settings`：单行（`id=1`），存 `og_image` / `twitter_site` / `twitter_creator` / `author` / `robots` / `site_url`
- `site_seo_i18n`：站点级 `site_title` / `site_description` / `keywords`

多语言模型：所有可翻译字段都是单个 `*_i18n` TEXT，存 JSON `{"zh-CN":..,"en":..,"zh-Hant":..}`。服务端按 **当前 locale → zh-CN → 任意非空** 回退拍平。**新增语言只需补 JSON，无需 `ALTER TABLE`。**

`scripts/seed.mjs` 会读取并执行 `schema.sql`（含 schema 自带的 `INSERT OR IGNORE` 站点种子），再幂等写入 60 场演唱会、每场 3–6 首歌单与每场标签（按 `seq` 判重，可反复执行）。本地模式下 `npm run seed` 会在 `DATABASE_URL`（默认 `data/planet.db`）处建库写数据；若已有现成的 `.db` 文件，把 `DATABASE_URL` 指向它即可直接读取。`data/` 已在 `.gitignore` 中忽略。

## 3D 引擎要点

- Three.js 由 npm 包 `three@0.128` **动态 import** 后挂到全局 `window.THREE`（不再依赖第三方 CDN，消除供应链 / 可用性风险）；引擎代码仍按全局 `THREE` 编写，保持 r128 API。
- `planetTown.ts` 已从旧 `index.html` 内联 IIFE 移植为**容器化工厂**，并进一步按职责拆成 `concert/`（信息卡 / 弹窗 / 轮播 / 命中检测 / 安全链接）与 `town/`（村庄 / 角色 / 氛围 / 环绕）子模块；`mount/unmount` 适配组件生命周期（`unmount` 会 `cancelAnimationFrame`、移除监听并遍历释放几何 / 材质）。
- 信息卡数据源改为注入：`createPlanetTown(el, { stageInfos, labels })` 用 `/api/concerts` 数据逐台填充舞台；API 失败时**不摆假台**（无数据即跳过）。`labels` 由前端 i18n **逐键 `t()` 取字符串**传入——`@nuxtjs/i18n` v10 编译后的 `messages` 分组是 AST 节点而非字符串，不能直接展开。
- **语言切换不重建几何**：页面实例被复用时，`PlanetCanvas` 通过 `watch` 调 `engine.setLang(newLabels, newInfos)`，原地刷新文案 `L`、重灌本地化数据、刷新轮播，并**就地重绘已打开的信息卡**（若有）。
- 卡片命中用 Raycaster，坐标基于容器 `getBoundingClientRect`；点击舞台弹卡、再点同一舞台或点空白收起；点赞按钮 `POST /api/concerts/:id/like`（乐观更新）。外链经 `safeLink` 做 XSS 转义与协议 / 主机白名单校验。

> 注意：ES module 已隐式 strict，`createPlanetTown(container, opts = {})` 带默认值参数，函数体首行不能再写 `'use strict'`。

## SEO

- 每页每语言的 title / description / canonical / og / twitter，站点级文案读自 `site_settings` + `site_seo_i18n`（库不可用时回退 locale 文件与 `NUXT_PUBLIC_SITE_URL`）。
- `useLocaleHead` 输出 hreflang alternates（zh-CN / en / zh-Hant / x-default）与 `og:locale`。
- JSON-LD：首页 `WebSite`（含 `workExample` 指向星球，`interactionCount` 用真实点赞总和）。
- 静态 `public/robots.txt`（含 Sitemap 绝对 URL）与 `public/sitemap.xml`（3 URL：`/` × 3 语言）。
- 首页虽为客户端 3D 画布，但 SSR 输出标题、meta 与 JSON-LD，爬虫不会看到空壳。
- 首页与 `/en/`、`/zh-Hant/` 预渲染；`error.vue` 返回真实 404 且 `noindex`。

## 测试

```bash
npm run test           # Vitest 单测
npm run test:e2e       # Playwright E2E（配置会自动拉起 dev server）
```

- **单测**（`tests/unit/`）：i18n 拍平回退、`schema.sql` 表结构冻结、`safeLink`（XSS 转义 + URL 协议 / 主机白名单 + BVID 解析）、`concertLikes` 幂等点赞（首次 / 重复 / 取消 / 多 IP / 计数下限，用临时文件库）、`rateLimit` 固定窗口、`client-ip`（HMAC 去重 + 反代转发头）、`concert-config` 不变量、三语 locale key 一致。
- **E2E**（`tests/e2e/`）：`/` 中文 hero 与 `/en/` `/zh-Hant/` 前缀、语言切换器切到英文、`/api/concerts` 结构合法且本地化字段随 locale 变化、like 接口校验（非法 id→400 / 不存在→404 / 正常 toggle）、**WebGL 画布挂载 + 点击舞台弹出信息卡（数据来自 API）+ 点赞**、轮播标签可见且 `×` 可收起、**切换语言时就地刷新已打开的信息卡**、三语 title/canonical/hreflang、JSON-LD 可解析、`og:type`、robots/sitemap/404 noindex。

- 无头环境用 SwiftShader 提供 WebGL，`playwright.config.ts` 已注入 `--use-angle=swiftshader` 等参数。
- 固定 `locale: 'zh-CN'`，避免 i18n `detectBrowserLanguage` 把 `/` 重定向到 `/en/`。
- 首次运行若缺浏览器：`npx playwright install chromium`。
- WebGL 场景测试较重，并行 worker 多时点击 / 路由跳转可能偶发超时；排查时可用 `--workers=1` 复跑确认是否为环境竞争而非逻辑问题。

## 常用脚本

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 开发服务器 |
| `npm run build` / `npm run preview` | 生产构建 / 预览 |
| `npm run seed` | 建库 + 写演唱会 / 歌单 / 标签种子（幂等，60 场） |
| `npm run test` / `npm run test:e2e` | 单测 / E2E |
| `npm run typecheck` | `vue-tsc` 类型检查 |
