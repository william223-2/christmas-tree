# 部署到 GitHub Pages（不需要装 Git）

静态版在 `docs/` 目录里，一共 4 个文件，GitHub Pages 直接就能跑。

## 一、你需要做的（约 3 分钟）

1. 打开 <https://github.com/new>，仓库名填 `quiztree`（或随便），**Public**，点 Create repository。
2. 进仓库 → 点 **Add file → Upload files** → 把 `F:\deepseekworkspace\wishtree\docs\` 里的
   `index.html`、`style.css`、`app.js`、`.nojekyll` 拖进去 → Commit changes。
   （`.nojekyll` 在资源管理器里可能看不见，先把「查看 → 隐藏的项目」打开。）
3. 仓库 → **Settings → Pages** → Source 选 **Deploy from a branch**，Branch 选 `main` + 目录选 `/ (root)`（或把文件放进 `docs/` 就选 `/docs`）→ Save。
4. 等 1–2 分钟，页面顶部会给出地址：
   `https://<你的用户名>.github.io/quiztree/`

## 二、上传后的链接长什么样

- 首页：`https://<user>.github.io/quiztree/`
- 你种的树：`https://<user>.github.io/quiztree/#/t/LeyJuYW1lIjoi...`（很长，因为题目全编码在链接里）

## 三、静态版的限制（重要）

GitHub Pages 只有静态文件，没有服务器，所以：

| 能力 | 静态版 | 需要后端 |
|---|---|---|
| 朋友答题、看到自己爬到第几层 | ✅ | — |
| 排行榜（谁在最高处） | ⚠️ 只统计**他自己设备**上的记录 | ✅ 全站共享 |
| 主人改题、删记录 | ❌ | ✅ |
| 链接长度 | 1–1.5 KB（题目都编在链接里） | 短（只有 7 位码） |

想要「短链接 + 真·排行榜」，三条路，任选：

1. **Supabase**（推荐，免费）：注册 → 新建项目 → 把 Project URL 和 anon key 给我，我加一个适配层，前端仍放 GitHub Pages。
2. **Render / Railway**：把 `server.js` 直接部署上去（仓库里已经有），需要登录授权，数据存在文件里（免费层重启会重置）。
3. **本机 + Cloudflare Tunnel**：`cloudflared tunnel --url http://localhost:5180`，立刻得到一个 https 短链接，排行榜走本机 JSON，缺点是你电脑得开着。

## 四、本地预览

```bash
cd F:\deepseekworkspace\wishtree
node server.js 5180          # 完整版（有 API、有排行榜）
```

只想看静态版：
```bash
cd F:\deepseekworkspace\wishtree\docs
python -m http.server 5190
```
