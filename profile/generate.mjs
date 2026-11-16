// Draws every image in README.md from live GitHub data, in dark and light:
//   title-*     the name in contribution-graph cells
//   intro-*     the one-line intro
//   snake-*     the last year of contributions, eaten by a growing snake
//   stats-*     contributions, longest streak, stars, pub.dev packages
//   project-*   one card per project, with its commit history as a cell strip
//   button-*    the link buttons
//
//   GITHUB_TOKEN=... node profile/generate.mjs [OUT_DIR]
import { writeFileSync, mkdirSync } from "node:fs";

const LOGIN = "Muzammil-Bit";
const NAME = "Muzammil Hussain";
const OUT = process.argv[2] ?? "dist";
const PUB_PACKAGES = 1;
const NOW = Date.now();

const THEMES = {
  dark: { bg: "#0d1117", card: "#161b22", border: "#30363d", fg: "#e6edf3", muted: "#8b949e", empty: "#161b22",
    levels: ["#0e4429", "#006d32", "#26a641", "#39d353"], accent: "#54c5f8", deep: "#0175c2", eye: "#0d1117" },
  light: { bg: "#ffffff", card: "#f6f8fa", border: "#d0d7de", fg: "#1f2328", muted: "#656d76", empty: "#ebedf0",
    levels: ["#9be9a8", "#40c463", "#30a14e", "#216e39"], accent: "#0175c2", deep: "#54c5f8", eye: "#ffffff" },
};
const SANS = `-apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Helvetica, Arial, sans-serif`;
const MONO = `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lerp = (a, b, f) => "#" + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * f).toString(16).padStart(2, "0")).join("");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const fmt = (n) => n.toLocaleString("en-US");
const svg = (w, h, body, css = "", extra = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="${SANS}"${extra}><style>${css}</style>${body}</svg>\n`;

// Mixed-case 8-row pixel font: rows 0-6 body, row 7 descender.
const UP = {
  M: "10001 11011 10101 10101 10001 10001 10001", H: "10001 10001 10001 11111 10001 10001 10001",
};
const LOW = {
  a: "00000 00000 01110 00001 01111 10001 01111 00000", i: "010 000 110 010 010 010 111 000",
  l: "110 010 010 010 010 010 111 000", m: "00000 00000 11010 10101 10101 10101 10101 00000",
  n: "00000 00000 11110 10001 10001 10001 10001 00000", s: "00000 00000 01111 10000 01110 00001 11110 00000",
  u: "00000 00000 10001 10001 10001 10011 01101 00000", z: "00000 00000 11111 00010 00100 01000 11111 00000",
};
const glyph = (ch) => (ch === " " ? Array(8).fill("00") : UP[ch] ? [...UP[ch].split(" "), "00000"] : LOW[ch].split(" "));

function banner(th) {
  const t = THEMES[th], pitch = 12, size = 10;
  const lit = new Set();
  let col = 1;
  for (const ch of NAME) {
    const g = glyph(ch);
    g.forEach((row, r) => [...row].forEach((v, c) => v === "1" && lit.add(`${col + c},${r + 1}`)));
    col += g[0].length + 1;
  }
  const cols = col, rows = 10;
  let seed = 42;
  const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const cells = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const on = lit.has(`${c},${r}`), roll = rnd(), f = c / (cols - 1);
    const fill = on ? (f < 0.45 ? lerp(t.levels[2], t.levels[3], f / 0.45) : lerp(t.levels[3], t.accent, (f - 0.45) / 0.55))
      : roll < 0.06 ? t.levels[0] : t.empty;
    const anim = on ? ` style="animation:sh 5s ease-in-out ${(c * 0.04).toFixed(2)}s infinite"` : "";
    cells.push(`<rect x="${c * pitch}" y="${r * pitch}" width="${size}" height="${size}" rx="2" fill="${fill}"${anim}/>`);
  }
  const css = `@keyframes sh{0%,75%,100%{opacity:1;transform:none}85%{opacity:.4;transform:scale(.75)}}rect{transform-box:fill-box;transform-origin:center}`;
  return svg(cols * pitch - 2, rows * pitch - 2, cells.join(""), css, ` role="img" aria-label="${NAME}"`);
}

function intro(th) {
  const t = THEMES[th], w = 840, h = 64;
  const parts = [
    ["Mobile developer", t.fg], [" from Lahore building ", t.muted], ["Flutter apps", t.accent],
    [" end to end: the animated UI and the backend behind it.", t.muted],
  ];
  const text = parts.map(([s, c]) => `<tspan fill="${c}"${c === t.fg || c === t.accent ? ' font-weight="600"' : ""}>${s}</tspan>`).join("");
  const css = `.c{animation:blink 1.1s steps(1) infinite}@keyframes blink{50%{opacity:0}}`;
  return svg(w, h,
    `<text x="${w / 2}" y="26" font-size="17" text-anchor="middle">${text}</text>` +
    `<text x="${w / 2}" y="52" font-size="13" text-anchor="middle" fill="${t.muted}" font-family="${MONO}">flutter · .net · node · ai features · open to freelance<tspan class="c" fill="${t.accent}"> ▍</tspan></text>`, css);
}

function weeksFromCal(cal) {
  return cal.weeks.map((w) => w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount, row: d.weekday })));
}

function snake(weeks, total, th) {
  const t = THEMES[th], P = 14, S = 11, L = 34, T = 24, TICK = 0.06, PAUSE = 7;
  const x = (c) => L + c * P, y = (r) => T + r * P;
  const all = weeks.flat();
  const max = Math.max(...all.map((d) => d.count));
  const level = (n) => Math.min(3, Math.floor((n / max) * 4));
  const activeDays = all.filter((d) => d.count).length;
  let streak = 0, best = 0;
  for (const d of all) best = Math.max(best, (streak = d.count ? streak + 1 : 0));

  const path = [];
  for (let k = 5; k >= 1; k--) path.push([-k, 0]);
  weeks.forEach((_, c) => { for (let k = 0; k < 7; k++) path.push([c, c % 2 ? 6 - k : k]); });
  const start = 3, finalLen = start + activeDays;
  const [lc, lr] = path.at(-1);
  for (let k = 1; k <= finalLen + 2; k++) path.push([lc + k, lr]);

  const run = (path.length - 1) * TICK, dur = run + PAUSE;
  const pc = (s) => `${Math.min(100, Math.max(0, (s / dur) * 100)).toFixed(3)}%`;
  const heading = (j) => {
    const [a, b] = [path[j], path[Math.min(j + 1, path.length - 1)]];
    return b[0] > a[0] ? 0 : b[1] > a[1] ? 90 : b[1] < a[1] ? -90 : 0;
  };
  const css = [`@keyframes mv{${path.map(([c, r], j) => `${pc(j * TICK)}{transform:translate(${x(c) + S / 2}px,${y(r) + S / 2}px) rotate(${heading(j)}deg)}`).join("")}}`];
  const out = [];
  const text = (tx, ty, s, a = "start") => `<text x="${tx}" y="${ty}" fill="${t.muted}" font-size="10" text-anchor="${a}">${s}</text>`;

  let prev = -1, lastCol = -9;
  weeks.forEach((w, c) => {
    const m = new Date(w[0].date).getUTCMonth();
    if (m !== prev && c - lastCol >= 3 && c < weeks.length - 2) {
      out.push(text(x(c), T - 8, new Date(Date.UTC(2000, m, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" })));
      lastCol = c;
    }
    prev = m;
  });
  [[1, "Mon"], [3, "Wed"], [5, "Fri"]].forEach(([r, s]) => out.push(text(L - 6, y(r) + 9, s, "end")));

  const byCell = new Map();
  weeks.forEach((w, c) => w.forEach((d) => byCell.set(`${c},${d.row}`, d)));
  for (const [k] of byCell) { const [c, r] = k.split(",").map(Number); out.push(`<rect x="${x(c)}" y="${y(r)}" width="${S}" height="${S}" rx="2.5" fill="${t.empty}"/>`); }
  const eats = [];
  path.forEach(([c, r], j) => { const d = byCell.get(`${c},${r}`); if (d?.count) eats.push({ j, c, r, d }); });
  eats.forEach((e, n) => {
    const at = e.j * TICK;
    css.push(`@keyframes e${n}{0%,${pc(at)}{opacity:1}${pc(at + 0.1)},${pc(dur - 0.6)}{opacity:0}100%{opacity:1}}`);
    out.push(`<rect x="${x(e.c)}" y="${y(e.r)}" width="${S}" height="${S}" rx="2.5" fill="${t.levels[level(e.d.count)]}" style="animation:e${n} ${dur}s linear infinite"/>`);
  });

  const fy = T + 7 * P + 18;
  out.push(text(L, fy, `${fmt(total)} contributions in the last year`));
  const lx = L + weeks.length * P - 5 * P - 30;
  out.push(text(lx - 5, fy, "Less", "end"));
  [t.empty, ...t.levels].forEach((f, i) => out.push(`<rect x="${lx + i * P}" y="${fy - 9}" width="${S}" height="${S}" rx="2.5" fill="${f}"/>`));
  out.push(text(lx + 5 * P + 2, fy, "More"));

  for (let i = finalLen - 1; i >= 1; i--) {
    const anim = [`mv ${dur}s linear ${(i * TICK).toFixed(3)}s infinite backwards`];
    if (i >= start) {
      const g = eats[i - start].j * TICK;
      css.push(`@keyframes g${i}{0%,${pc(g)}{opacity:0}${pc(g + 0.01)},100%{opacity:1}}`);
      anim.push(`g${i} ${dur}s linear infinite`);
    }
    const r = 5.4 - (i / finalLen) * 1.8;
    out.push(`<g style="animation:${anim.join(",")}${i >= start ? ";opacity:0" : ""}"><circle r="${r.toFixed(2)}" fill="${lerp(t.accent, t.deep, i / finalLen)}"/></g>`);
  }
  out.push(`<g style="animation:mv ${dur}s linear infinite backwards"><path d="M-7 -6 H2 Q8 -6 8 0 Q8 6 2 6 H-7 Z" fill="${t.accent}"/><circle cx="3" cy="-2.8" r="1.7" fill="${t.eye}"/><circle cx="3" cy="2.8" r="1.7" fill="${t.eye}"/></g>`);

  const mx = L + (weeks.length * P) / 2, my = T + 3.5 * P;
  css.push(`@keyframes res{0%,${pc(run + 0.2)}{opacity:0}${pc(run + 0.6)},${pc(dur - 0.8)}{opacity:1}${pc(dur - 0.4)},100%{opacity:0}}`);
  out.push(`<g style="animation:res ${dur}s linear infinite;opacity:0"><rect x="${L - 2}" y="${T - 2}" width="${weeks.length * P + 2}" height="${7 * P + 2}" fill="${t.bg}" opacity=".92"/>` +
    `<text x="${mx}" y="${my - 8}" fill="${t.fg}" font-size="22" font-weight="700" text-anchor="middle">Snake ate ${fmt(total)} contributions</text>` +
    `<text x="${mx}" y="${my + 14}" fill="${t.muted}" font-size="12" text-anchor="middle">${activeDays} active days · ${best}-day streak · final length ${finalLen}</text>` +
    `<text x="${mx}" y="${my + 36}" fill="${t.accent}" font-size="12" font-weight="600" text-anchor="middle">Round two starting…</text></g>`);

  return { svg: svg(L + weeks.length * P + 12, T + 7 * P + 30, out.join(""), css.join("")), activeDays, best };
}

function statsStrip(items, th) {
  const t = THEMES[th], w = 840, h = 86, cw = w / items.length;
  const body = items.map(([value, label], i) => {
    const cx = cw * i + cw / 2;
    return `<g style="animation:up .6s ease-out ${(i * 0.15).toFixed(2)}s both">` +
      `<text x="${cx}" y="38" font-size="28" font-weight="700" fill="${i === 0 ? t.accent : t.fg}" text-anchor="middle">${value}</text>` +
      `<text x="${cx}" y="62" font-size="12" fill="${t.muted}" text-anchor="middle">${label}</text></g>` +
      (i ? `<line x1="${cw * i}" y1="18" x2="${cw * i}" y2="66" stroke="${t.border}"/>` : "");
  }).join("");
  return svg(w, h, `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="10" fill="${t.card}" stroke="${t.border}"/>${body}`,
    `@keyframes up{from{opacity:0;transform:translateY(8px)}}`);
}

function wrap(s, max) {
  const lines = [""];
  for (const word of s.split(" ")) {
    if ((lines.at(-1) + " " + word).trim().length > max) lines.push(word);
    else lines[lines.length - 1] = (lines.at(-1) + " " + word).trim();
  }
  return lines;
}

function projectCard(p, th) {
  const t = THEMES[th], w = 840, h = 118;
  const dates = p.dates.map((d) => new Date(d).getTime()).sort((a, b) => a - b);
  const N = 26, lo = dates[0], hi = Math.max(NOW, dates.at(-1) + 1);
  const buckets = Array(N).fill(0);
  dates.forEach((d) => buckets[Math.min(N - 1, Math.floor(((d - lo) / (hi - lo)) * N))]++);
  const bmax = Math.max(...buckets);
  const gx = w - 24 - N * 12 + 2;
  const grid = buckets.map((b, i) => {
    const f = b ? [t.levels[0], t.levels[1], t.levels[2], t.levels[3]][Math.min(3, Math.floor((b / bmax) * 4))] : t.empty;
    return `<rect x="${gx + i * 12}" y="70" width="10" height="10" rx="2" fill="${f}" style="animation:pop .4s ease-out ${(0.3 + i * 0.03).toFixed(2)}s both"/>`;
  }).join("");
  const since = new Date(lo).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  const desc = wrap(p.desc, 70).slice(0, 2).map((l, i) => `<text x="24" y="${62 + i * 18}" font-size="13" fill="${t.muted}">${esc(l)}</text>`).join("");
  const body =
    `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="10" fill="${t.card}" stroke="${t.border}"/>` +
    `<rect x="0" y="16" width="3" height="${h - 32}" rx="1.5" fill="${t.accent}"/>` +
    `<text x="24" y="36" font-size="18" font-weight="700" fill="${t.fg}">${esc(p.title)}</text>` +
    `<text x="${w - 24}" y="36" font-size="12" fill="${t.muted}" text-anchor="end"><tspan fill="${t.accent}">●</tspan> ${p.language ?? "Dart"}   ★ ${p.stars}${p.tag ? `   ${p.tag}` : ""}</text>` +
    desc + grid +
    `<text x="${w - 24}" y="98" font-size="10" fill="${t.muted}" text-anchor="end">${p.dates.length} commits since ${since}</text>`;
  return svg(w, h, body, `@keyframes pop{from{opacity:0;transform:scale(.3)}}rect{transform-box:fill-box;transform-origin:center}`);
}

function button(label, th, i) {
  const t = THEMES[th], w = 22 + label.length * 7.6, h = 34;
  return svg(Math.round(w), h,
    `<rect x=".5" y=".5" width="${Math.round(w) - 1}" height="${h - 1}" rx="17" fill="${t.card}" stroke="${t.border}"/>` +
    `<rect x=".5" y=".5" width="${Math.round(w) - 1}" height="${h - 1}" rx="17" fill="none" stroke="${t.accent}" stroke-dasharray="${Math.round(w * 2)}" style="animation:draw 1.2s ease-out ${(i * 0.2).toFixed(1)}s both"/>` +
    `<text x="${Math.round(w) / 2}" y="22" font-size="13" font-weight="600" fill="${t.fg}" text-anchor="middle">${label}</text>`,
    `@keyframes draw{from{stroke-dashoffset:${Math.round(w * 2)}}to{stroke-dashoffset:0}}`);
}

async function gh(path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method: body ? "POST" : "GET",
    headers: { authorization: `bearer ${process.env.GITHUB_TOKEN}`, "user-agent": "profile-readme", accept: "application/vnd.github+json" },
    body: body && JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub ${path}: ${res.status} ${await res.text()}`);
  return { json: await res.json(), link: res.headers.get("link") ?? "" };
}

async function calendar() {
  const query = `query($login: String!) { user(login: $login) { contributionsCollection { contributionCalendar {
    totalContributions weeks { contributionDays { date contributionCount weekday } } } } } }`;
  const { json } = await gh("/graphql", { query, variables: { login: LOGIN } });
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.user.contributionsCollection.contributionCalendar;
}

async function commitDates(repo) {
  const dates = [];
  for (let page = 1; ; page++) {
    const { json, link } = await gh(`/repos/${LOGIN}/${repo}/commits?per_page=100&page=${page}`);
    dates.push(...json.map((c) => c.commit.author.date));
    if (!link.includes('rel="next"')) return dates;
  }
}

const PROJECTS = [
  { repo: "pocket_chess", slug: "pocket-chess", title: "Pocket Chess",
    desc: "A Flutter chess app with local play, AI opponents, time controls, game history and custom piece themes." },
  { repo: "dot_curved_bottom_nav", slug: "dot-curved-bottom-nav", title: "dot_curved_bottom_nav", tag: "pub.dev",
    desc: "An animated bottom navigation bar for Flutter, with custom colours, animation speed and more." },
  { repo: "muzammil_hussain", slug: "portfolio", title: "Portfolio",
    desc: "My personal site, built in Flutter, with animation on every page and a custom pre-loader while Flutter loads." },
];
const BUTTONS = ["Portfolio", "LinkedIn", "Email"];

const cal = await calendar();
const { json: repos } = await gh(`/users/${LOGIN}/repos?per_page=100&type=owner`);
const own = repos.filter((r) => !r.fork);
const stars = own.reduce((n, r) => n + r.stargazers_count, 0);
for (const p of PROJECTS) {
  const r = own.find((x) => x.name === p.repo);
  Object.assign(p, { stars: r?.stargazers_count ?? 0, language: r?.language ?? "Dart", dates: await commitDates(p.repo) });
}

mkdirSync(OUT, { recursive: true });
const weeks = weeksFromCal(cal);
for (const th of Object.keys(THEMES)) {
  writeFileSync(`${OUT}/title-${th}.svg`, banner(th));
  writeFileSync(`${OUT}/intro-${th}.svg`, intro(th));
  const s = snake(weeks, cal.totalContributions, th);
  writeFileSync(`${OUT}/snake-${th}.svg`, s.svg);
  writeFileSync(`${OUT}/stats-${th}.svg`, statsStrip([
    [fmt(cal.totalContributions), "contributions this year"], [`${s.best} days`, "longest streak"],
    [fmt(stars), "stars on my repos"], [String(PUB_PACKAGES), PUB_PACKAGES === 1 ? "package on pub.dev" : "packages on pub.dev"],
  ], th));
  PROJECTS.forEach((p) => writeFileSync(`${OUT}/project-${p.slug}-${th}.svg`, projectCard(p, th)));
  BUTTONS.forEach((b, i) => writeFileSync(`${OUT}/button-${b.toLowerCase().replace(/[^a-z]+/g, "-")}-${th}.svg`, button(b, th, i)));
}
console.log(`wrote ${OUT}: ${cal.totalContributions} contributions, ${stars} stars`);
