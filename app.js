/* ============================================================
   圣诞树 · Quiz Tree —— 前端逻辑
   ============================================================ */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const state = {
    meta: null,
    tree: null,
    isOwner: false,
    token: null,
    quiz: null,
    draft: { avatar: "rabbit", mood: "", theme: "christmas", name: "" },
  };

  /* ---------------- 存储 ---------------- */
  const MY_KEY = "qt.myTrees";
  const myTrees = () => {
    try {
      return JSON.parse(localStorage.getItem(MY_KEY) || "[]");
    } catch {
      return [];
    }
  };
  const saveMy = (list) => localStorage.setItem(MY_KEY, JSON.stringify(list.slice(0, 40)));
  const rememberTree = (code, token, name) => {
    const list = myTrees().filter((x) => x.code !== code);
    list.unshift({ code, token, name, at: Date.now() });
    saveMy(list);
  };
  const tokenFor = (code) => {
    const hit = myTrees().find((x) => x.code === code);
    return hit ? hit.token : null;
  };

  /* ---------------- 存储后端 ----------------
     三种模式：
       server   —— 本地/自托管 Node 服务（有 API）
       link     —— 纯静态（GitHub Pages）：树的内容编码在链接里，成绩存本机
  */
  const store = { mode: "server" };

  const b64e = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const b64d = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

  const LOCAL_TRIES = (code) => {
    try { return JSON.parse(localStorage.getItem("qt.tries." + code) || "[]"); } catch { return []; }
  };
  const saveLocalTries = (code, list) => localStorage.setItem("qt.tries." + code, JSON.stringify(list.slice(0, 200)));

  function linkTree(code) {
    const t = JSON.parse(b64d(code.slice(1)));
    const tries = LOCAL_TRIES(code);
    const sorted = [...tries].sort((a, b) => b.score - a.score || a.at - b.at);
    return {
      code, name: t.name, avatar: t.avatar, mood: t.mood, theme: t.theme,
      createdAt: t.createdAt, total: t.questions.length,
      questions: t.questions.map((q) => ({ q: q.q, options: q.options })),
      tries: sorted.map((x, i) => ({ id: x.id, name: x.name, animal: x.animal, score: x.score, rank: i + 1, at: x.at })),
      _raw: t,
    };
  }

  function linkApi(path, opts) {
    const parts = path.replace(/^\/api\//, "").split("/").filter(Boolean);
    if (parts[0] === "meta") {
      return Promise.resolve({
        themes: ["christmas", "snow", "birthday", "newyear"],
        avatars: Object.keys(ANIMAL_LABEL), animals: Object.keys(ANIMAL_LABEL),
        moods: ["圣诞睡衣派对", "热可可和毛毯", "一起堆雪人", "烤曲奇的味道", "窗外在下雪", "今年的雪特别大"],
        count: 0, mode: "link",
      });
    }
    if (parts[0] === "trees" && !parts[1] && opts.method === "POST") {
      const b = opts.body;
      const t = {
        name: b.name, avatar: b.avatar, mood: b.mood, theme: b.theme,
        createdAt: Date.now(), questions: b.questions,
      };
      const code = "L" + b64e(JSON.stringify(t));
      return Promise.resolve({ code, token: "local", name: b.name });
    }
    const code = parts[1];
    if (!code) return Promise.reject(new Error("bad-path"));
    if (parts[2] === "tries" && opts.method === "POST") {
      const tree = linkTree(code);
      const b = opts.body;
      let score = 0;
      tree._raw.questions.forEach((q, i) => { if (Number(b.answers[i]) === q.answer) score += 1; });
      const rec = { id: Math.random().toString(36).slice(2, 10), name: b.name, animal: b.animal, score, at: Date.now() };
      const list = LOCAL_TRIES(code); list.push(rec); saveLocalTries(code, list);
      const rank = list.filter((x) => x.score > score || (x.score === score && x.at < rec.at)).length + 1;
      return Promise.resolve({ id: rec.id, name: rec.name, animal: rec.animal, score, total: tree.total, rank, top: rank === 1, count: list.length });
    }
    if (parts[2] === "tries" && opts.method === "DELETE") {
      const list = LOCAL_TRIES(code).filter((x) => x.id !== parts[3]);
      saveLocalTries(code, list);
      return Promise.resolve(linkTree(code));
    }
    if (opts.method === "PATCH") return Promise.resolve(linkTree(code));
    return Promise.resolve(linkTree(code));
  }

  /* ---------------- 网络 ---------------- */
  async function api(path, opts = {}) {
    if (store.mode === "link") return linkApi(path, opts);
    const headers = { "content-type": "application/json" };
    if (state.token) headers.authorization = "Bearer " + state.token;
    const res = await fetch(path, {
      method: opts.method || "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) throw new Error((data && data.error) || "request-failed");
    return data;
  }

  /* ---------------- 小工具 ---------------- */
  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function openModal(id) {
    $(id).classList.add("open");
    $(id).setAttribute("aria-hidden", "false");
  }
  function closeModal(el) {
    el.classList.remove("open");
    el.setAttribute("aria-hidden", "true");
  }

  const THEME_LABEL = { christmas: "圣诞夜", snow: "初雪", birthday: "生日", newyear: "新年" };
  const ANIMAL_LABEL = {
    rabbit: "兔子", cat: "小猫", fox: "狐狸", panda: "熊猫",
    penguin: "企鹅", bear: "小熊", deer: "小鹿", bird: "小鸟",
  };
  const ANIMAL_COLOR = {
    rabbit: ["#fdf6f7", "#f4cdd6"], cat: ["#ffd9a8", "#f3a95f"],
    fox: ["#ffb27a", "#e8703c"], panda: ["#f7f7f9", "#2f3338"],
    penguin: ["#f4f8ff", "#2b3444"], bear: ["#d8a06a", "#a9713f"],
    deer: ["#e8b985", "#b57d47"], bird: ["#bfe4ff", "#6aa7d8"],
  };

  /* ---------------- 动物插画 ---------------- */
  function animalArt(kind) {
    const [c1, c2] = ANIMAL_COLOR[kind] || ANIMAL_COLOR.rabbit;
    const eyeY = 36;
    const eyes = `<circle cx="32.5" cy="${eyeY}" r="2.6" fill="#2c2622"/><circle cx="47.5" cy="${eyeY}" r="2.6" fill="#2c2622"/>
      <circle cx="33.4" cy="${eyeY - 0.9}" r=".8" fill="#fff"/><circle cx="48.4" cy="${eyeY - 0.9}" r=".8" fill="#fff"/>`;
    const blush = `<ellipse cx="26" cy="45" rx="4.4" ry="2.8" fill="#ff9db2" opacity=".55"/><ellipse cx="54" cy="45" rx="4.4" ry="2.8" fill="#ff9db2" opacity=".55"/>`;
    const scarf = `<path d="M28 58 q12 7 24 0 l3 8 q-15 8 -30 0z" fill="#e8453c"/><path d="M50 64 l7 12 -8 3 -3 -12z" fill="#e8453c"/>`;
    let ears = "";
    let extra = "";
    let nose = `<path d="M37.5 44 l5 0 -2.5 3z" fill="#c0655f"/>`;

    if (kind === "rabbit") {
      ears = `<ellipse cx="30" cy="12" rx="6.4" ry="15" fill="${c1}" stroke="${c2}" stroke-width="1.4"/>
        <ellipse cx="50" cy="12" rx="6.4" ry="15" fill="${c1}" stroke="${c2}" stroke-width="1.4"/>
        <ellipse cx="30" cy="13" rx="2.8" ry="9.5" fill="#ffc7d3"/><ellipse cx="50" cy="13" rx="2.8" ry="9.5" fill="#ffc7d3"/>`;
    } else if (kind === "cat") {
      ears = `<path d="M22 24 l2 -15 13 8z" fill="${c1}" stroke="${c2}" stroke-width="1.4"/>
        <path d="M58 24 l-2 -15 -13 8z" fill="${c1}" stroke="${c2}" stroke-width="1.4"/>
        <path d="M25 21 l1 -8 6.5 4z" fill="#ffc7d3"/><path d="M55 21 l-1 -8 -6.5 4z" fill="#ffc7d3"/>`;
      extra = `<path d="M16 40 l-8 -3M16 44 l-9 1M64 40 l8 -3M64 44 l9 1" stroke="${c2}" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>`;
    } else if (kind === "fox") {
      ears = `<path d="M21 25 l1 -18 15 10z" fill="${c2}"/><path d="M59 25 l-1 -18 -15 10z" fill="${c2}"/>
        <path d="M25 14 l-1 7 6 -4z" fill="#3a2a22"/><path d="M55 14 l1 7 -6 -4z" fill="#3a2a22"/>`;
      extra = `<path d="M20 40 q20 16 40 0 -8 14 -20 14 -12 0 -20 -14z" fill="#fff8f0" opacity=".85"/>`;
    } else if (kind === "panda") {
      ears = `<circle cx="24" cy="17" r="8" fill="${c2}"/><circle cx="56" cy="17" r="8" fill="${c2}"/>`;
      extra = `<ellipse cx="32.5" cy="${eyeY}" rx="7" ry="8" fill="${c2}" opacity=".92"/><ellipse cx="47.5" cy="${eyeY}" rx="7" ry="8" fill="${c2}" opacity=".92"/>`;
    } else if (kind === "penguin") {
      ears = "";
      extra = `<path d="M40 14 q19 0 19 22 q0 22 -19 22 q-19 0 -19 -22 q0 -22 19 -22z" fill="${c2}"/>
        <ellipse cx="40" cy="42" rx="14" ry="16" fill="${c1}"/>`;
      nose = `<path d="M36 43 l8 0 -4 5z" fill="#f5a623"/>`;
    } else if (kind === "bear") {
      ears = `<circle cx="24" cy="18" r="8.4" fill="${c1}" stroke="${c2}" stroke-width="1.4"/>
        <circle cx="56" cy="18" r="8.4" fill="${c1}" stroke="${c2}" stroke-width="1.4"/>
        <circle cx="24" cy="18" r="3.6" fill="#f0c9a8"/><circle cx="56" cy="18" r="3.6" fill="#f0c9a8"/>`;
      extra = `<ellipse cx="40" cy="46" rx="9" ry="7" fill="#f6dcc2"/>`;
    } else if (kind === "deer") {
      ears = `<path d="M28 24 q-6 -14 2 -18 q4 6 2 16" fill="none" stroke="#a9713f" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M52 24 q6 -14 -2 -18 q-4 6 -2 16" fill="none" stroke="#a9713f" stroke-width="2.6" stroke-linecap="round"/>
        <ellipse cx="23" cy="27" rx="7" ry="4.6" fill="${c1}" transform="rotate(-24 23 27)"/>
        <ellipse cx="57" cy="27" rx="7" ry="4.6" fill="${c1}" transform="rotate(24 57 27)"/>`;
      extra = `<ellipse cx="40" cy="47" rx="8.6" ry="6.6" fill="#fdeee0"/>`;
    } else {
      ears = `<path d="M40 16 q10 -8 14 2 q-8 4 -14 2z" fill="${c2}" opacity=".8"/>`;
      extra = `<ellipse cx="40" cy="58" rx="17" ry="15" fill="${c1}"/>`;
      nose = `<path d="M36 43 l8 0 -4 5z" fill="#f5a623"/>`;
    }

    return `<svg viewBox="0 0 80 90" width="80" height="90" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      ${kind === "penguin" ? "" : `<ellipse cx="40" cy="66" rx="20" ry="17" fill="${c1}" stroke="${c2}" stroke-width="1.4"/>`}
      ${ears}
      ${kind === "penguin" ? "" : `<circle cx="40" cy="35" r="20" fill="${c1}" stroke="${c2}" stroke-width="1.6"/>`}
      ${extra}
      ${eyes}
      ${blush}
      ${nose}
      ${scarf}
    </svg>`;
  }

  /* ---------------- 树 ---------------- */
  const VB = { w: 1000, h: 1180 };
  const APEX = 128;
  const BASE = 1012;
  const LEVELS = 10;
  const CX = 500;

  const yFor = (score, total) => BASE - ((score || 0) / Math.max(total || LEVELS, 1)) * (BASE - APEX);
  const halfW = (y) => Math.max(0, ((y - APEX) / (BASE - APEX)) * 400);
  const tierY = (i) => BASE - ((i + 1) / LEVELS) * (BASE - APEX);

  function tierPath(i, inset = 0) {
    const yT = tierY(i + 1) + 6;
    const yB = tierY(i);
    const wT = halfW(yT) * 0.74 + inset;
    const wB = halfW(yB) * 1.0 + inset;
    const drop = 24 + i * 1.2;
    const sc = 6;
    let d = `M ${CX - wT} ${yT}`;
    d += ` C ${CX - wT * 1.18} ${yT + drop}, ${CX - wB * 0.92} ${yB - drop * 0.5}, ${CX - wB} ${yB}`;
    for (let k = 0; k < sc; k++) {
      const x0 = CX - wB + ((wB * 2) / sc) * k;
      const x1 = CX - wB + ((wB * 2) / sc) * (k + 1);
      d += ` Q ${(x0 + x1) / 2} ${yB + 20}, ${x1} ${yB}`;
    }
    d += ` C ${CX + wB * 0.92} ${yB - drop * 0.5}, ${CX + wT * 1.18} ${yT + drop}, ${CX + wT} ${yT}`;
    d += " Z";
    return d;
  }

  function lightsRow(y, w, n) {
    let out = "";
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const x = CX - w + w * 2 * t;
      const yy = y + Math.sin(t * Math.PI) * 10 + 4;
      const colors = ["#ffd66b", "#ff9db2", "#9ad4ff", "#a8f0cf"];
      const c = colors[k % colors.length];
      out += `<circle cx="${x.toFixed(1)}" cy="${yy.toFixed(1)}" r="4.6" fill="${c}" opacity=".95" class="twinkle" style="animation-delay:${(k % 5) * 0.4}s"/>`;
    }
    return out;
  }

  function treeSVG(tree, opts = {}) {
    const total = tree.total || LEVELS;
    const tries = tree.tries || [];
    const showOwner = tree.avatar || "rabbit";

    let tiers = "";
    for (let i = 0; i < LEVELS; i++) {
      const shade = ["var(--green-1)", "var(--green-2)", "var(--green-3)"][i % 3];
      tiers += `<path d="${tierPath(i)}" fill="${shade}" opacity="${0.94 - (LEVELS - i) * 0.012}"/>`;
      tiers += `<path d="${tierPath(i)}" fill="none" stroke="rgba(200,255,225,.16)" stroke-width="2"/>`;
      const yB = tierY(i);
      tiers += `<path d="M ${CX - halfW(yB) * 0.96} ${yB - 6} Q ${CX} ${yB + 16} ${CX + halfW(yB) * 0.96} ${yB - 6}" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="4" stroke-linecap="round" opacity=".55"/>`;
      tiers += lightsRow(yB - 8, halfW(yB) * 0.84, 7 + (i % 2));
    }

    // 点缀：彩球 / 拐杖糖 / 雪堆
    let seed = 20261225;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const ballColors = ["#e8453c", "#ffd66b", "#6fb9f0", "#f2a5c8", "#b48cf2", "#7fe2b0"];
    let deco = "";
    for (let i = 0; i < LEVELS; i++) {
      const yB = tierY(i);
      const hw = halfW(yB);
      const n = 4 + (i % 3);
      for (let k = 0; k < n; k++) {
        const t = -0.84 + (1.68 * (k + rnd() * 0.5)) / n;
        const x = CX + t * hw;
        const y = yB - 16 - rnd() * 30;
        const r = 7 + rnd() * 4;
        const col = ballColors[(i * 3 + k) % ballColors.length];
        deco += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${col}" opacity=".95" stroke="rgba(255,255,255,.6)" stroke-width="1.2"/>`;
        deco += `<circle cx="${(x - r * 0.32).toFixed(1)}" cy="${(y - r * 0.36).toFixed(1)}" r="${(r * 0.3).toFixed(1)}" fill="rgba(255,255,255,.8)"/>`;
      }
      // 雪堆
      deco += `<path d="M ${CX - hw * 0.94} ${yB - 4} q ${hw * 0.3} 14 ${hw * 0.52} 2 q ${hw * 0.2} -10 ${hw * 0.42} 2 q ${hw * 0.2} 12 ${hw * 0.94} -2" fill="rgba(255,255,255,.28)"/>`;
    }
    // 拐杖糖
    [-0.62, 0.12, 0.7].forEach((t, i) => {
      const y = tierY(2 + i * 3) - 10;
      const x = CX + t * halfW(y);
      deco += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${i % 2 ? 18 : -16})">
        <rect x="-5" y="-34" width="10" height="34" rx="5" fill="#fff"/>
        <path d="M0 -34 q10 0 10 10 q0 10 -10 10" fill="none" stroke="#e8453c" stroke-width="8" stroke-linecap="round"/>
        <path d="M0 -28 q5 0 5 5" fill="none" stroke="#fff" stroke-width="4"/>
      </g>`;
    });

    // 树顶星
    const star = `<g class="sway" style="transform-origin:${CX}px ${APEX - 6}px">
      <path d="M ${CX} ${APEX - 74} l 15 44 46 3 -36 30 13 45 -38 -26 -38 26 13 -45 -36 -30 46 -3 z"
        fill="url(#starGrad)" stroke="#ffd76b" stroke-width="2"/>
      <circle cx="${CX}" cy="${APEX - 6}" r="52" fill="url(#glowGrad)" opacity=".55"/>
    </g>`;

    // 树干 + 雪地 + 礼物
    const trunk = `<path d="M ${CX - 26} ${BASE - 6} h 52 v 66 q0 12 -12 12 h -28 q-12 0 -12 -12z" fill="#6b452a"/>
      <path d="M ${CX - 26} ${BASE - 6} h 18 v 78 h -18z" fill="#563520" opacity=".55"/>`;

    const ground = `<ellipse cx="${CX}" cy="${BASE + 84}" rx="392" ry="52" fill="#e9f4ff" opacity=".16"/>
      <path d="M ${CX - 430} ${BASE + 96} q 130 -34 250 -6 q 90 20 180 -4 q 120 -30 250 12 v 92 h -680z" fill="#eaf6ff" opacity=".92"/>
      <path d="M ${CX - 300} ${BASE + 92} q 120 -26 230 0 q 110 24 210 -8" fill="none" stroke="#fff" stroke-width="6" opacity=".8"/>`;

    const gifts = `
      <g class="sway" style="transform-origin:${CX - 210}px ${BASE + 70}px">
        <rect x="${CX - 262}" y="${BASE + 6}" width="86" height="72" rx="8" fill="#e8453c"/>
        <rect x="${CX - 232}" y="${BASE + 6}" width="26" height="72" fill="#ffd66b"/>
        <rect x="${CX - 262}" y="${BASE + 26}" width="86" height="14" fill="#ffd66b"/>
      </g>
      <g class="sway" style="transform-origin:${CX - 120}px ${BASE + 70}px; animation-delay:.8s">
        <rect x="${CX - 158}" y="${BASE + 26}" width="72" height="58" rx="7" fill="#3f8f6b"/>
        <rect x="${CX - 132}" y="${BASE + 26}" width="20" height="58" fill="#ffd66b"/>
        <rect x="${CX - 158}" y="${BASE + 44}" width="72" height="12" fill="#ffd66b"/>
      </g>
      <g class="sway" style="transform-origin:${CX + 200}px ${BASE + 70}px; animation-delay:1.6s">
        <rect x="${CX + 150}" y="${BASE + 18}" width="78" height="64" rx="8" fill="#4f6fd8"/>
        <rect x="${CX + 178}" y="${BASE + 18}" width="22" height="64" fill="#ffd66b"/>
        <rect x="${CX + 150}" y="${BASE + 38}" width="78" height="13" fill="#ffd66b"/>
      </g>`;

    // 树上的人（按分数定层）
    const byLevel = {};
    tries.forEach((t) => {
      const lv = Math.round(((t.score || 0) / Math.max(total, 1)) * total);
      (byLevel[lv] = byLevel[lv] || []).push(t);
    });

    let pins = "";
    Object.keys(byLevel).forEach((lv) => {
      const list = byLevel[lv].sort((a, b) => a.rank - b.rank);
      const y = yFor(Number(lv), total) - 14;
      const w = Math.max(halfW(y) * 0.66, 70);
      list.forEach((t, idx) => {
        const n = list.length;
        const frac = n === 1 ? (Number(lv) % 2 ? 0.5 : -0.5) : -1 + (2 * (idx + 0.5)) / n;
        const x = CX + frac * w;
        const scale = (0.62 + (Number(lv) / total) * 0.16) * 1.5;
        const crown = t.rank === 1
          ? `<path d="M ${x - 13} ${y - 54} l 6 -13 7 8 6 -11 6 11 7 -8 6 13z" fill="#ffcf5c" stroke="#e0a92e" stroke-width="1"/>`
          : "";
        pins += `<g class="pin-fade" style="animation-delay:${idx * 0.06}s">
          <g transform="translate(${x - 40 * scale} ${y - 86 * scale}) scale(${scale})">${animalArt(t.animal)}</g>
          ${crown}
          <text x="${x}" y="${y + 20}" text-anchor="middle" font-size="15" fill="rgba(255,255,255,.92)"
            font-family="var(--font)" font-weight="600">${esc(t.name)}</text>
        </g>`;
      });
    });

    const ownerPin = `<g transform="translate(${CX + 92} ${APEX + 18}) scale(.95)">${animalArt(showOwner)}</g>`;

    return `<svg viewBox="0 0 ${VB.w} ${VB.h}" xmlns="http://www.w3.org/2000/svg" role="img">
      <defs>
        <linearGradient id="starGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff6c9"/><stop offset="1" stop-color="#ffca45"/>
        </linearGradient>
        <radialGradient id="glowGrad">
          <stop offset="0" stop-color="#ffe9a8" stop-opacity=".9"/><stop offset="1" stop-color="#ffe9a8" stop-opacity="0"/>
        </radialGradient>
      </defs>
      ${ground}
      ${trunk}
      ${tiers}
      ${deco}
      ${gifts}
      ${pins}
      ${ownerPin}
      ${star}
    </svg>`;
  }

  function mountTree(el, tree) {
    el.innerHTML = treeSVG(tree);
  }

  /* ---------------- 背景 ---------------- */
  function initSky() {
    const cvs = $("#sky");
    const ctx = cvs.getContext("2d");
    let w = 0, h = 0, stars = [], flakes = [], shoot = null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      w = cvs.clientWidth; h = cvs.clientHeight;
      cvs.width = w * dpr; cvs.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: Math.round((w * h) / 9000) }, () => ({
        x: Math.random() * w, y: Math.random() * h * 0.9,
        r: Math.random() * 1.5 + 0.4, p: Math.random() * Math.PI * 2,
        s: Math.random() * 0.9 + 0.3,
      }));
      flakes = Array.from({ length: Math.round((w * h) / 24000) }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 2.1 + 0.8, vy: Math.random() * 0.5 + 0.25,
        vx: Math.random() * 0.4 - 0.2, p: Math.random() * Math.PI * 2,
      }));
    }
    window.addEventListener("resize", resize);
    resize();

    let t = 0;
    function frame() {
      t += 0.016;
      ctx.clearRect(0, 0, w, h);
      stars.forEach((s) => {
        const a = 0.35 + Math.sin(t * s.s + s.p) * 0.35;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7);
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`; ctx.fill();
      });
      flakes.forEach((f) => {
        f.y += f.vy; f.x += f.vx + Math.sin(t * 0.8 + f.p) * 0.3;
        if (f.y > h + 6) { f.y = -8; f.x = Math.random() * w; }
        if (f.x < -8) f.x = w + 8; if (f.x > w + 8) f.x = -8;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7);
        ctx.fillStyle = "rgba(255,255,255,.72)"; ctx.fill();
      });
      if (!shoot && Math.random() < 0.0035) {
        shoot = { x: Math.random() * w * 0.7, y: Math.random() * h * 0.3, life: 1 };
      }
      if (shoot) {
        shoot.life -= 0.02;
        shoot.x += 7; shoot.y += 3.4;
        const g = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - 90, shoot.y - 44);
        g.addColorStop(0, `rgba(255,255,255,${Math.max(shoot.life, 0)})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = g; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x - 90, shoot.y - 44); ctx.stroke();
        if (shoot.life <= 0) shoot = null;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------------- 撒花 ---------------- */
  function confetti() {
    const cvs = $("#confetti");
    const ctx = cvs.getContext("2d");
    cvs.width = window.innerWidth; cvs.height = window.innerHeight;
    const colors = ["#ffd66b", "#ff8b9c", "#7fe0c9", "#9ad4ff", "#fff"];
    const bits = Array.from({ length: 120 }, () => ({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 260,
      y: window.innerHeight * 0.42 + (Math.random() - 0.5) * 120,
      vx: (Math.random() - 0.5) * 8, vy: -Math.random() * 9 - 2,
      r: Math.random() * 5 + 3, c: colors[(Math.random() * colors.length) | 0],
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, life: 1,
    }));
    let raf;
    (function tick() {
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      let alive = 0;
      bits.forEach((b) => {
        b.vy += 0.26; b.x += b.vx; b.y += b.vy; b.rot += b.vr; b.life -= 0.008;
        if (b.life > 0 && b.y < cvs.height + 40) alive++;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
        ctx.globalAlpha = Math.max(b.life, 0);
        ctx.fillStyle = b.c; ctx.fillRect(-b.r / 2, -b.r / 2, b.r, b.r * 1.6);
        ctx.restore();
      });
      if (alive) raf = requestAnimationFrame(tick);
      else { cancelAnimationFrame(raf); ctx.clearRect(0, 0, cvs.width, cvs.height); }
    })();
  }

  /* ---------------- 路由 ---------------- */
  const views = ["home", "create", "visit", "quiz", "result", "tree", "mine"];
  function show(name) {
    views.forEach((v) => $("#view-" + v).classList.toggle("active", v === name));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, "");
    const [pathPart, queryPart] = raw.split("?");
    const parts = pathPart.split("/").filter(Boolean);
    return { parts, query: new URLSearchParams(queryPart || "") };
  }

  async function route() {
    const { parts } = parseHash();
    const head = parts[0] || "home";
    try {
      if (head === "home") return renderHome();
      if (head === "create") return renderCreate();
      if (head === "mine") return renderMine();
      if (head === "t" && parts[1]) return await enterTree(parts[1], parts[2]);
      return renderHome();
    } catch (e) {
      toast("出了点问题：" + e.message);
      renderHome();
    }
  }

  /* ---------------- 首页 ---------------- */
  function renderHome() {
    show("home");
    const demo = {
      total: 10,
      avatar: "rabbit",
      tries: [
        { name: "九月", animal: "fox", score: 10, rank: 1 },
        { name: "阿布", animal: "panda", score: 8, rank: 2 },
        { name: "小林", animal: "deer", score: 6, rank: 3 },
        { name: "momo", animal: "cat", score: 4, rank: 4 },
        { name: "鱼丸", animal: "penguin", score: 2, rank: 5 },
      ],
    };
    mountTree($("#homeTree"), demo);
  }

  /* ---------------- 出题 ---------------- */
  const DEFAULT_QUESTIONS = [
    { q: "我最喜欢的季节是？", options: ["春天", "夏天", "秋天", "冬天"], answer: 3 },
    { q: "我早上一般几点起床？", options: ["六点前", "七八点", "九十点", "中午"], answer: 1 },
    { q: "我喝奶茶必点？", options: ["三分糖去冰", "全糖加冰", "不喝奶茶", "无糖热饮"], answer: 0 },
    { q: "我最常熬夜的原因是？", options: ["刷剧", "写作业", "打游戏", "睡不着"], answer: 1 },
    { q: "我最怕的东西是？", options: ["虫子", "打雷", "高处", "人多"], answer: 0 },
    { q: "我出门必带？", options: ["耳机", "雨伞", "零食", "充电宝"], answer: 0 },
    { q: "我更喜欢？", options: ["猫", "狗", "都喜欢", "都不喜欢"], answer: 2 },
    { q: "我理想的假期是？", options: ["睡到自然醒", "出门旅行", "和朋友聚会", "一个人发呆"], answer: 0 },
    { q: "我最拿手的菜是？", options: ["泡面", "番茄炒蛋", "煮饺子", "不会做饭"], answer: 3 },
    { q: "我最近在追的东西是？", options: ["一部剧", "一本书", "一个游戏", "一部番"], answer: 3 },
  ];

  function renderCreate() {
    show("create");
    state.draft.name = "";
    state.draft.avatar = "rabbit";
    state.draft.theme = "christmas";
    state.draft.mood = (state.meta.moods && state.meta.moods[0]) || "圣诞睡衣派对";
    $("#step-profile").classList.remove("hidden");
    $("#step-questions").classList.add("hidden");
    $("#stepNo").textContent = "1";

    $("#avatarGrid").innerHTML = state.meta.avatars
      .map((a) => `<button class="avatar-opt${a === state.draft.avatar ? " on" : ""}" data-avatar="${a}" type="button">${animalArt(a)}<span>${ANIMAL_LABEL[a] || a}</span></button>`)
      .join("");
    $("#moodRow").innerHTML = state.meta.moods
      .map((m) => `<button class="chip${m === state.draft.mood ? " on" : ""}" data-mood="${esc(m)}" type="button">${esc(m)}</button>`)
      .join("");
    $("#themeRow").innerHTML = state.meta.themes
      .map((t) => `<button class="chip${t === state.draft.theme ? " on" : ""}" data-theme="${t}" type="button">${THEME_LABEL[t] || t}</button>`)
      .join("");

    if (!$("#qEditor").dataset.built) {
      buildEditor(DEFAULT_QUESTIONS);
      $("#qEditor").dataset.built = "1";
    }
  }

  function buildEditor(questions) {
    $("#qEditor").innerHTML = questions
      .map(
        (q, i) => `<div class="q-item" data-i="${i}">
        <div class="q-top"><span class="q-no">${i + 1}</span>
          <input class="q-input" data-f="q" maxlength="60" value="${esc(q.q)}" placeholder="问题，例如：我最喜欢的颜色是？"/>
        </div>
        <div class="q-opts">
          ${[0, 1, 2, 3]
            .map(
              (k) => `<label class="q-opt">
              <input type="radio" name="ans${i}" value="${k}" ${q.answer === k ? "checked" : ""}/>
              <input type="text" data-f="o${k}" maxlength="40" value="${esc(q.options[k] || "")}" placeholder="选项 ${k + 1}"/>
            </label>`
            )
            .join("")}
        </div>
      </div>`
      )
      .join("");
  }

  function readEditor() {
    return $$("#qEditor .q-item").map((el, i) => {
      const q = $('input[data-f="q"]', el).value.trim();
      const options = [0, 1, 2, 3].map((k) => $(`input[data-f="o${k}"]`, el).value.trim()).filter(Boolean);
      const checked = $(`input[type="radio"][name="ans${i}"]:checked`, el);
      let answer = checked ? Number(checked.value) : 0;
      // 选项被删掉时，答案索引可能越界 —— 夹一下
      if (answer >= options.length) answer = 0;
      return { q, options, answer };
    }).filter((x) => x.q && x.options.length >= 2);
  }

  async function createTree() {
    const name = $("#ownName").value.trim();
    if (!name) return toast("先写个名字吧");
    const questions = readEditor();
    if (questions.length < 3) return toast("至少写 3 道题哦");
    const btn = $("#createTree");
    btn.disabled = true;
    btn.textContent = "正在种树…";
    try {
      const res = await api("/api/trees", {
        method: "POST",
        body: { name, avatar: state.draft.avatar, mood: state.draft.mood, theme: state.draft.theme, questions },
      });
      rememberTree(res.code, res.token, res.name);
      toast("树种好了 🌲");
      location.hash = "#/t/" + res.code;
      confetti();
    } catch (e) {
      toast("没种成：" + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "生成我的树 🌟";
    }
  }

  /* ---------------- 树页 / 访客 ---------------- */
  async function enterTree(code, sub) {
    state.token = tokenFor(code);
    const tree = await api("/api/trees/" + code);
    state.tree = tree;
    state.isOwner = Array.isArray(tree.questions) && tree.questions.some((q) => typeof q.answer === "number");
    document.body.dataset.theme = tree.theme || "christmas";

    if (sub === "quiz") return startQuizScreen();
    state.pendingCode = code;
    if (!state.triesDone && tree.tries.length > 0 && sub !== "tree") {
      // 有人的树先给落地页；空树也是落地页
    }
    renderVisit(tree, code);
  }

  function renderVisit(tree, code) {
    state.pendingCode = code;
    show("visit");
    $("#visitPhoto").innerHTML = animalArt(tree.avatar);
    $("#visitOwner").textContent = tree.name;
    $("#visitHeadline").innerHTML = `<b>${esc(tree.name)}</b> 想让你出现在 TA 的圣诞树上 🎄`;
    $("#visitMood").textContent = "圣诞心情：" + tree.mood;
    const top = tree.tries.find((t) => t.rank === 1);
    $("#visitStat").innerHTML = tree.tries.length
      ? `已经有 <b>${tree.tries.length}</b> 位朋友在树上 🎄<br/>${esc(top.name)} 目前站在最高处 🌟`
      : `还没有人爬上去 🎄<br/>你可以当第一个`;
    $("#visitorName").value = "";
    $("#animalGrid").innerHTML = state.meta.animals
      .map(
        (a) => `<button class="avatar-opt${a === "rabbit" ? " on" : ""}" data-animal="${a}" type="button">${animalArt(a)}<span>${ANIMAL_LABEL[a] || a}</span></button>`
      )
      .join("");
    state.draft.animal = "rabbit";
    $("#view-visit .hint-line span:first-child").textContent = `回答 ${tree.total} 道关于 TA 的问题`;
  }

  function renderTree(tree) {
    show("tree");
    document.body.dataset.theme = tree.theme || "christmas";
    $("#treeName").textContent = tree.name + " 的圣诞树";
    $("#treeSub").textContent = `${tree.tries.length} 位朋友在树上 · 共 ${tree.total} 层`;
    mountTree($("#treeWrap"), tree);

    const board = $("#board");
    const rows = tree.tries.slice(0, 30);
    board.innerHTML = `<h3>谁爬得最高</h3><p class="board-sub">答对一题，爬一层</p>` +
      (rows.length
        ? `<ul class="board-list">${rows
            .map(
              (t) => `<li class="board-row${t.rank === 1 ? " top" : ""}">
            <span class="rk">${t.rank === 1 ? "👑" : t.rank}</span>
            ${animalArt(t.animal)}
            <span class="who">${esc(t.name)}</span>
            <span class="sc">${t.score}/${tree.total}</span>
          </li>`
            )
            .join("")}</ul>`
        : `<p class="board-empty">还没有人，来当第一个吧</p>`);

    $("#ownerPanelBtn").classList.toggle("hidden", !state.isOwner);
  }

  /* ---------------- 问答 ---------------- */
  function startQuizScreen() {
    const tree = state.tree;
    const name = ($("#visitorName").value || "").trim() || "匿名朋友";
    const animal = state.draft.animal || "rabbit";
    state.quiz = { tree, code: state.pendingCode || tree.code, name, animal, i: 0, answers: [] };
    state.quizOwnerLabel = tree.name;
    show("quiz");
    $("#quizOwner").textContent = `关于 ${tree.name}`;
    paintQuestion();
  }

  function paintQuestion() {
    const q = state.quiz;
    const cur = q.tree.questions[q.i];
    $("#quizBar").style.width = `${((q.i) / q.tree.total) * 100}%`;
    $("#quizCount").textContent = `${q.i + 1} / ${q.tree.total}`;
    $("#quizQuestion").textContent = cur.q;
    $("#quizOptions").innerHTML = cur.options
      .map((o, k) => `<button class="option" data-k="${k}" type="button">${esc(o)}</button>`)
      .join("");
    $("#quizTip").textContent = "选一个你最有把握的答案";
  }

  async function pickOption(k) {
    const q = state.quiz;
    const cur = q.tree.questions[q.i];
    q.answers.push(k);
    $$("#quizOptions .option").forEach((b) => b.classList.toggle("picked", Number(b.dataset.k) === k));
    const right = typeof cur.answer === "number" ? Number(k) === cur.answer : null;
    if (right !== null) $("#quizTip").textContent = right ? "对了！往上爬一层 🎄" : "这题没中，继续吧";
    await new Promise((r) => setTimeout(r, 420));
    if (q.i + 1 >= q.tree.total) return submitQuiz();
    q.i += 1;
    paintQuestion();
  }

  async function submitQuiz() {
    const q = state.quiz;
    try {
      const res = await api(`/api/trees/${q.code}/tries`, {
        method: "POST",
        body: { name: q.name, animal: q.animal, answers: q.answers },
      });
      show("result");
      $("#resultScore").textContent = `${res.score} / ${res.total} 层`;
      $("#resultAnimal").innerHTML = animalArt(res.animal);
      const lines = [
        "答对一题就往上爬一层，你的小动物已经挂好啦。",
        res.top ? "你是目前站在最高处的人，皇冠归你 👑" : `你现在排在第 ${res.rank} 位，前面还有 ${res.rank - 1} 个人。`,
      ];
      $("#resultLine").textContent = lines.join(" ");
      if (res.top) confetti();
    } catch (e) {
      toast("交卷失败：" + e.message);
    }
  }

  /* ---------------- 我的树 ---------------- */
  function renderMine() {
    show("mine");
    const list = myTrees();
    $("#mineList").innerHTML = list.length
      ? list
          .map(
            (t) => `<a class="mine-item" href="#/t/${t.code}">
          ${animalArt("rabbit")}
          <span class="mi-main"><b>${esc(t.name)}</b><span>#/t/${t.code}</span></span>
          <span class="tiny">打开 →</span>
        </a>`
          )
          .join("")
      : `<p class="mine-empty">这台设备上还没有种过树。</p>`;
  }

  /* ---------------- 主人设置 ---------------- */
  async function openOwner() {
    if (!state.isOwner) return;
    $("#editName").value = state.tree.name;
    $("#editMood").value = state.tree.mood;
    $("#editThemeRow").innerHTML = state.meta.themes
      .map((t) => `<button class="chip${t === state.tree.theme ? " on" : ""}" data-edit-theme="${t}" type="button">${THEME_LABEL[t] || t}</button>`)
      .join("");
    $("#ownerTries").innerHTML = state.tree.tries.length
      ? state.tree.tries
          .map(
            (t) => `<div class="owner-try">${animalArt(t.animal)}<span>${esc(t.name)}</span><span class="sc">${t.score}/${state.tree.total}</span>
        <button class="ot-x" data-del="${t.id}" type="button">摘掉</button></div>`
          )
          .join("")
      : `<p class="board-empty">还没有人</p>`;
    openModal("#modalOwner");
  }

  async function saveOwner() {
    const body = { name: $("#editName").value.trim(), mood: $("#editMood").value.trim() };
    const onTheme = $("#editThemeRow .chip.on");
    if (onTheme) body.theme = onTheme.dataset.editTheme;
    try {
      state.tree = await api("/api/trees/" + state.tree.code, { method: "PATCH", body });
      closeModal($("#modalOwner"));
      renderTree(state.tree);
      toast("已更新");
    } catch (e) {
      toast("保存失败：" + e.message);
    }
  }

  /* ---------------- 导出图片 ---------------- */
  async function exportTree() {
    const svg = $("#treeWrap svg");
    if (!svg) return;
    const clone = svg.cloneNode(true);
    clone.setAttribute("width", VB.w);
    clone.setAttribute("height", VB.h);
    // 内联主题色，避免导出后 CSS 变量丢失
    const cs = getComputedStyle(document.body);
    const vars = ["--green-1", "--green-2", "--green-3"];
    vars.forEach((v) => {
      const val = cs.getPropertyValue(v).trim();
      clone.querySelectorAll(`[fill="${v}"]`).forEach((el) => el.setAttribute("fill", val || "#2f7d58"));
    });
    const xml = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const W = 1080, H = 1350;
      const cvs = document.createElement("canvas");
      cvs.width = W; cvs.height = H;
      const ctx = cvs.getContext("2d");
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, cs.getPropertyValue("--sky-2").trim() || "#123049");
      g.addColorStop(1, cs.getPropertyValue("--sky-1").trim() || "#0a1f2e");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const scale = Math.min(W / VB.w, (H - 130) / VB.h);
      ctx.drawImage(img, (W - VB.w * scale) / 2, 30, VB.w * scale, VB.h * scale);
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.font = "600 34px 'PingFang SC','Microsoft YaHei',sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(state.tree.name + " 的圣诞树", W / 2, H - 54);
      URL.revokeObjectURL(url);
      cvs.toBlob((b) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = `christmas-tree-${state.tree.code}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
        toast("图片已保存 📸");
      }, "image/png");
    };
    img.onerror = () => toast("导出失败，试试截图");
    img.src = url;
  }

  /* ---------------- 事件 ---------------- */
  function bind() {
    $("#showHelp").addEventListener("click", () => openModal("#modalHelp"));
    $$("[data-close]").forEach((b) => b.addEventListener("click", () => closeModal(b.closest(".modal"))));
    $$(".modal").forEach((m) => m.addEventListener("click", (e) => { if (e.target === m) closeModal(m); }));

    // 出题：选头像 / 心情 / 配色
    document.addEventListener("click", (e) => {
      const av = e.target.closest("[data-avatar]");
      if (av) {
        state.draft.avatar = av.dataset.avatar;
        $$("#avatarGrid .avatar-opt").forEach((b) => b.classList.toggle("on", b === av));
      }
      const mo = e.target.closest("[data-mood]");
      if (mo) {
        state.draft.mood = mo.dataset.mood;
        $$("#moodRow .chip").forEach((b) => b.classList.toggle("on", b === mo));
      }
      const th = e.target.closest("[data-theme]");
      if (th && $("#themeRow").contains(th)) {
        state.draft.theme = th.dataset.theme;
        document.body.dataset.theme = th.dataset.theme;
        $$("#themeRow .chip").forEach((b) => b.classList.toggle("on", b === th));
      }
      const eth = e.target.closest("[data-edit-theme]");
      if (eth) $$("#editThemeRow .chip").forEach((b) => b.classList.toggle("on", b === eth));
      const an = e.target.closest("[data-animal]");
      if (an) {
        state.draft.animal = an.dataset.animal;
        $$("#animalGrid .avatar-opt").forEach((b) => b.classList.toggle("on", b === an));
      }
      const del = e.target.closest("[data-del]");
      if (del) removeTry(del.dataset.del);
    });

    $("#toQuestions").addEventListener("click", () => {
      const name = $("#ownName").value.trim();
      if (!name) return toast("先写个名字吧");
      state.draft.name = name;
      $("#step-profile").classList.add("hidden");
      $("#step-questions").classList.remove("hidden");
      $("#stepNo").textContent = "2";
      $("#createTitle").textContent = "出 10 道关于你的题";
    });
    $("#backProfile").addEventListener("click", () => {
      $("#step-profile").classList.remove("hidden");
      $("#step-questions").classList.add("hidden");
      $("#stepNo").textContent = "1";
      $("#createTitle").textContent = "先说说是谁要种树";
    });
    $("#fillDefault").addEventListener("click", () => {
      buildEditor(DEFAULT_QUESTIONS);
      toast("默认题目已填好，可以逐条改");
    });
    $("#createTree").addEventListener("click", createTree);

    $("#startQuiz").addEventListener("click", () => {
      if (!$("#visitorName").value.trim()) return toast("先留个名字吧");
      startQuizScreen();
    });

    $("#quizOptions").addEventListener("click", (e) => {
      const b = e.target.closest(".option");
      if (b) pickOption(Number(b.dataset.k));
    });

    $("#goTree").addEventListener("click", () => {
      location.hash = "#/t/" + (state.quiz ? state.quiz.code : state.pendingCode);
    });
    $("#retryQuiz").addEventListener("click", () => {
      if (state.tree) renderVisit(state.tree, state.tree.code);
    });
    $("#joinToo").addEventListener("click", () => {
      if (state.tree) renderVisit(state.tree, state.tree.code);
    });

    $("#copyLink").addEventListener("click", async () => {
      const url = `${location.origin}/#/t/${state.tree.code}`;
      try {
        await navigator.clipboard.writeText(url);
        toast("链接已复制");
      } catch {
        const ta = document.createElement("textarea");
        ta.value = url; document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); ta.remove();
        toast("链接已复制");
      }
    });
    $("#exportTree").addEventListener("click", exportTree);
    $("#ownerPanelBtn").addEventListener("click", openOwner);
    $("#saveOwner").addEventListener("click", saveOwner);
  }

  async function removeTry(id) {
    try {
      state.tree = await api(`/api/trees/${state.tree.code}/tries/${id}`, { method: "DELETE" });
      toast("已摘掉");
      openOwner();
      renderTree(state.tree);
    } catch (e) {
      toast("没删掉：" + e.message);
    }
  }

  /* ---------------- 启动 ---------------- */
  async function boot() {
    initSky();
    bind();
    // 静态托管（GitHub Pages）没有 /api，探测不到就切到 link 模式：树的内容编码在链接里
    try {
      const r = await fetch("/api/meta", { method: "GET" });
      if (!r.ok) throw new Error("no-api");
      store.mode = "server";
    } catch {
      store.mode = "link";
      document.body.dataset.mode = "link";
    }
    try {
      state.meta = await api("/api/meta");
    } catch {
      state.meta = {
        themes: ["christmas", "snow", "birthday", "newyear"],
        avatars: Object.keys(ANIMAL_LABEL), animals: Object.keys(ANIMAL_LABEL),
        moods: ["圣诞睡衣派对", "热可可和毛毯", "一起堆雪人", "烤曲奇的味道", "窗外在下雪", "今年的雪特别大"],
      };
    }
    window.addEventListener("hashchange", route);
    await route();
  }

  boot();
})();
