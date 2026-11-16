// Draws every image in README.md from live GitHub data, in dark and light:
//   title-*     the name in contribution-graph cells
//   activity-*  the last year of contributions, eaten by a growing snake, with
//               contributions, longest streak and stars underneath
//   section-*   the section labels
//   project-*   one card per project
//   contrib-*   one card per open-source repo, one dot per pull request
//   button-*    the link buttons
//
//   GITHUB_TOKEN=... node profile/generate.mjs [OUT_DIR]
import { writeFileSync, mkdirSync } from "node:fs";

const LOGIN = "Muzammil-Bit";
const NAME = "Muzammil Hussain";
const OUT = process.argv[2] ?? "dist";

const THEMES = {
  dark: { bg: "#0d1117", card: "#161b22", border: "#30363d", fg: "#e6edf3", muted: "#8b949e", empty: "#161b22",
    levels: ["#0e4429", "#006d32", "#26a641", "#39d353"], accent: "#54c5f8", deep: "#0175c2", eye: "#0d1117", tongue: "#ff7b72" },
  light: { bg: "#ffffff", card: "#f6f8fa", border: "#d0d7de", fg: "#1f2328", muted: "#656d76", empty: "#ebedf0",
    levels: ["#9be9a8", "#40c463", "#30a14e", "#216e39"], accent: "#0175c2", deep: "#54c5f8", eye: "#1f2328", tongue: "#cf222e" },
};
const SANS = `-apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Helvetica, Arial, sans-serif`;

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
      : roll < 0.035 ? t.levels[0] : t.empty;
    const anim = on ? ` style="animation:sh 5s ease-in-out ${(c * 0.04).toFixed(2)}s infinite"` : "";
    cells.push(`<rect x="${c * pitch}" y="${r * pitch}" width="${size}" height="${size}" rx="2" fill="${fill}"${anim}/>`);
  }
  const css = `@keyframes sh{0%,75%,100%{opacity:1;transform:none}85%{opacity:.4;transform:scale(.75)}}rect{transform-box:fill-box;transform-origin:center}`;
  return svg(cols * pitch - 2, rows * pitch - 2, cells.join(""), css, ` role="img" aria-label="${NAME}"`);
}

function weeksFromCal(cal) {
  return cal.weeks.map((w) => w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount, row: d.weekday })));
}

function snake(weeks, total, th) {
  const t = THEMES[th], P = 14, S = 11, L = 34, T = 24, TICK = 0.26, PAUSE = 7;
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
  // Grows one segment every few active days, up to MAX_LEN, so it stays a snake and not a blob.
  const start = 4, MAX_LEN = 22, per = Math.max(1, Math.ceil(activeDays / (MAX_LEN - start)));
  const finalLen = Math.min(MAX_LEN, start + Math.floor(activeDays / per));
  const [lc, lr] = path.at(-1);
  for (let k = 1; k <= finalLen + 2; k++) path.push([lc + k, lr]);

  const run = (path.length - 1) * TICK, dur = run + PAUSE;
  const pc = (s) => `${Math.min(100, Math.max(0, (s / dur) * 100)).toFixed(3)}%`;
  const heading = (j) => {
    const [a, b] = [path[j], path[Math.min(j + 1, path.length - 1)]];
    return b[0] > a[0] ? 0 : b[1] > a[1] ? 90 : b[1] < a[1] ? -90 : 0;
  };
  const css = [`.tg{transform-box:view-box;animation:tf 1.6s steps(1) infinite}@keyframes tf{0%,60%{opacity:0}61%,100%{opacity:1}}`, `@keyframes mv{${path.map(([c, r], j) => `${pc(j * TICK)}{transform:translate(${x(c) + S / 2}px,${y(r) + S / 2}px) rotate(${heading(j)}deg)}`).join("")}}`];
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
  const lx = L + weeks.length * P - 5 * P - 30;
  out.push(text(lx - 5, fy, "Less", "end"));
  [t.empty, ...t.levels].forEach((f, i) => out.push(`<rect x="${lx + i * P}" y="${fy - 9}" width="${S}" height="${S}" rx="2.5" fill="${f}"/>`));
  out.push(text(lx + 5 * P + 2, fy, "More"));

  // Two beads per segment, half a cell apart, so the body reads as one smooth tube.
  for (let b = 2 * (finalLen - 1); b >= 1; b--) {
    const i = Math.ceil(b / 2);
    const anim = [`mv ${dur}s linear ${((b * TICK) / 2).toFixed(3)}s infinite backwards`];
    if (i >= start) {
      const g = eats[(i - start + 1) * per - 1].j * TICK;
      if (b % 2) css.push(`@keyframes g${i}{0%,${pc(g)}{opacity:0}${pc(g + 0.01)},100%{opacity:1}}`);
      anim.push(`g${i} ${dur}s linear infinite`);
    }
    // Beads overlap into one tapering body; the tail fades into the page by colour, not opacity, so overlaps stay clean.
    const f = b / (2 * finalLen);
    const r = 7.4 - f * 4.2;
    const fill = lerp(lerp(t.accent, t.deep, Math.min(1, f * 1.4)), t.bg, f ** 1.6 * 0.85);
    out.push(`<g style="animation:${anim.join(",")}${i >= start ? ";opacity:0" : ""}"><circle r="${r.toFixed(2)}" fill="${fill}"/></g>`);
  }
  out.push(`<g style="animation:mv ${dur}s linear infinite backwards">` +
    `<path class="tg" d="M7 0 H13 M13 0 L15.5 -2 M13 0 L15.5 2" stroke="${t.tongue}" stroke-width="1.3" stroke-linecap="round" fill="none"/>` +
    `<ellipse rx="9" ry="8" cx="1" fill="${t.accent}"/>` +
    `<circle cx="4" cy="-3.8" r="2.6" fill="#ffffff"/><circle cx="4" cy="3.8" r="2.6" fill="#ffffff"/>` +
    `<circle cx="5" cy="-3.8" r="1.3" fill="${t.eye}"/><circle cx="5" cy="3.8" r="1.3" fill="${t.eye}"/></g>`);

  const mx = L + (weeks.length * P) / 2, my = T + 3.5 * P;
  css.push(`@keyframes res{0%,${pc(run + 0.2)}{opacity:0}${pc(run + 0.6)},${pc(dur - 0.8)}{opacity:1}${pc(dur - 0.4)},100%{opacity:0}}`);
  out.push(`<g style="animation:res ${dur}s linear infinite;opacity:0"><rect x="${L - 2}" y="${T - 2}" width="${weeks.length * P + 2}" height="${7 * P + 2}" fill="${t.bg}" opacity=".92"/>` +
    `<text x="${mx}" y="${my - 8}" fill="${t.fg}" font-size="22" font-weight="700" text-anchor="middle">Snake ate ${fmt(total)} contributions</text>` +
    `<text x="${mx}" y="${my + 14}" fill="${t.muted}" font-size="12" text-anchor="middle">${activeDays} active days · ${best}-day streak · snake length ${finalLen}</text>` +
    `<text x="${mx}" y="${my + 36}" fill="${t.accent}" font-size="12" font-weight="600" text-anchor="middle">Round two starting…</text></g>`);

  return { body: out.join(""), css: css.join(""), w: L + weeks.length * P + 12, h: T + 7 * P + 30, activeDays, best };
}

const W = 880;
const card = (t, w, h, x = 0, y = 0) => `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="12" fill="${t.bg}" stroke="${t.border}"/>`;
const textW = (s, size) => s.length * size * 0.56;

// The contribution graph, the snake and the year's numbers in one panel.
function activityPanel(weeks, total, stars, th) {
  const t = THEMES[th], s = snake(weeks, total, th);
  const gx = Math.round((W - s.w) / 2), gy = 46, h = 300;
  const stats = [[fmt(total), "contributions in the last year"], [`${s.best} days`, "longest streak"], [fmt(stars), "stars across my repos"]];
  const cw = (W - 48) / stats.length;
  const statBody = stats.map(([v, l], i) => {
    const x = 24 + cw * i + cw / 2;
    return `<text x="${x}" y="${gy + s.h + 52}" font-size="22" font-weight="700" fill="${i === 0 ? t.accent : t.fg}" text-anchor="middle">${v}</text>` +
      `<text x="${x}" y="${gy + s.h + 74}" font-size="12" fill="${t.muted}" text-anchor="middle">${l}</text>` +
      (i ? `<line x1="${24 + cw * i}" y1="${gy + s.h + 30}" x2="${24 + cw * i}" y2="${gy + s.h + 80}" stroke="${t.border}"/>` : "");
  }).join("");
  const body = card(t, W, h) +
    `<text x="24" y="32" font-size="14" font-weight="600" fill="${t.fg}">Contribution activity</text>` +
    `<g transform="translate(${gx} ${gy})">${s.body}</g>` +
    `<line x1="24" y1="${gy + s.h + 12}" x2="${W - 24}" y2="${gy + s.h + 12}" stroke="${t.border}"/>` + statBody;
  return svg(W, h, body, s.css, ` role="img" aria-label="Contribution graph with a snake"`);
}

function sectionLabel(label, th) {
  const t = THEMES[th], h = 44, tw = textW(label, 15) + 14;
  return svg(W, h,
    `<rect x="0" y="17" width="4" height="16" rx="2" fill="${t.accent}"/>` +
    `<text x="14" y="30" font-size="15" font-weight="600" fill="${t.fg}">${esc(label)}</text>` +
    `<line x1="${tw + 14}" y1="25" x2="${W}" y2="25" stroke="${t.border}"/>`);
}

function wrap(s, max) {
  const lines = [""];
  for (const word of s.split(" ")) {
    if ((lines.at(-1) + " " + word).trim().length > max) lines.push(word);
    else lines[lines.length - 1] = (lines.at(-1) + " " + word).trim();
  }
  return lines;
}

// One of three cards that sit side by side, each linked to its project.
function projectCard(p, th) {
  const t = THEMES[th], w = 284, h = 156;
  const desc = wrap(p.desc, 38).slice(0, 3).map((l, i) => `<text x="22" y="${70 + i * 18}" font-size="12.5" fill="${t.muted}">${esc(l)}</text>`).join("");
  const tw = p.tag ? textW(p.tag, 10.5) + 16 : 0;
  const tag = p.tag ? `<rect x="${w - 22 - tw}" y="118" width="${tw}" height="20" rx="10" fill="none" stroke="${t.accent}"/>` +
    `<text x="${w - 22 - tw / 2}" y="132" font-size="10.5" fill="${t.accent}" text-anchor="middle">${p.tag}</text>` : "";
  const body = card(t, w, h) + tag +
    `<text x="22" y="36" font-size="16" font-weight="700" fill="${t.fg}">${esc(p.title)}</text>` + desc +
    `<text x="22" y="132" font-size="11" fill="${t.muted}"><tspan fill="${t.accent}">●</tspan> ${p.language} · ★ ${p.stars} · ${p.commits} commits</text>`;
  return svg(w, h, body);
}

// An open-source repo I contribute to, with one dot per pull request.
function contribCard(c, th) {
  const t = THEMES[th], w = 434, h = 104;
  const merged = c.prs.filter((p) => p.merged).length, open = c.prs.length - merged;
  const dots = c.prs.map((p, i) => {
    const x = w - 22 - (c.prs.length - 1 - i) * 18, y = 70;
    return p.merged ? `<circle cx="${x}" cy="${y}" r="6" fill="${t.accent}"/>`
      : `<circle cx="${x}" cy="${y}" r="5.3" fill="none" stroke="${t.accent}" stroke-width="1.4"/>`;
  }).join("");
  const parts = [merged && `${merged} merged`, open && `${open} in review`].filter(Boolean).join(" · ");
  const body = card(t, w, h) +
    `<text x="22" y="38" font-size="15" font-weight="700" fill="${t.fg}">${esc(c.name)}</text>` +
    `<text x="22" y="58" font-size="12" fill="${t.muted}">${esc(c.repo)}</text>` +
    `<text x="22" y="82" font-size="12" fill="${t.muted}">${c.prs.length} pull requests · ${parts}</text>` + dots;
  return svg(w, h, body);
}

const ICONS = {
  Portfolio: (c) => `<circle cx="0" cy="0" r="6.5" fill="none" stroke="${c}" stroke-width="1.4"/><ellipse rx="2.8" ry="6.5" fill="none" stroke="${c}" stroke-width="1.2"/><line x1="-6.5" y1="0" x2="6.5" y2="0" stroke="${c}" stroke-width="1.2"/>`,
  LinkedIn: (c) => `<rect x="-6.5" y="-6.5" width="13" height="13" rx="3" fill="none" stroke="${c}" stroke-width="1.4"/><text x="0" y="3.6" font-size="9" font-weight="700" fill="${c}" text-anchor="middle">in</text>`,
  Email: (c) => `<rect x="-7" y="-5" width="14" height="10" rx="2" fill="none" stroke="${c}" stroke-width="1.4"/><path d="M-6 -3.8 L0 0.8 L6 -3.8" fill="none" stroke="${c}" stroke-width="1.3" stroke-linejoin="round"/>`,
};
function button(label, th) {
  const t = THEMES[th], w = 136, h = 40;
  return svg(w, h, card(t, w, h).replace('rx="12"', 'rx="20"') +
    `<g transform="translate(30 20)">${ICONS[label](t.accent)}</g>` +
    `<text x="${46}" y="25" font-size="13" font-weight="600" fill="${t.fg}">${label}</text>`);
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

// One commit per page, so the last page number in the Link header is the count.
async function commitCount(repo) {
  const { json, link } = await gh(`/repos/${LOGIN}/${repo}/commits?per_page=1`);
  const last = link.match(/[?&]page=(\d+)>; rel="last"/);
  return last ? Number(last[1]) : json.length;
}

async function pullRequests(repo) {
  const q = encodeURIComponent(`is:pr author:${LOGIN} repo:${repo}`);
  const { json } = await gh(`/search/issues?q=${q}&per_page=100&sort=created&order=asc`);
  return json.items.filter((i) => i.state === "closed" ? i.pull_request.merged_at : true)
    .map((i) => ({ merged: Boolean(i.pull_request.merged_at) }));
}

const PROJECTS = [
  { repo: "pocket_chess", slug: "pocket-chess", title: "Pocket Chess",
    desc: "A Flutter chess app with local play, AI opponents, time controls, game history and piece themes." },
  { repo: "dot_curved_bottom_nav", slug: "dot-curved-bottom-nav", title: "dot_curved_bottom_nav", tag: "pub.dev",
    desc: "An animated bottom navigation bar for Flutter, with custom colours and animation speed." },
  { repo: "muzammil_hussain", slug: "portfolio", title: "Portfolio",
    desc: "My personal site, built in Flutter, with animation on every page and a custom pre-loader." },
];
const CONTRIBUTIONS = [
  { slug: "flutter", name: "Flutter", repo: "flutter/flutter" },
  { slug: "t3code", name: "T3 Code", repo: "pingdotgg/t3code" },
];
const BUTTONS = ["Portfolio", "LinkedIn", "Email"];
const SECTIONS = [["built", "Things I've built"], ["open-source", "Open source"], ["find-me", "Find me"]];

const cal = await calendar();
const { json: repos } = await gh(`/users/${LOGIN}/repos?per_page=100&type=owner`);
const own = repos.filter((r) => !r.fork);
const stars = own.reduce((n, r) => n + r.stargazers_count, 0);
for (const p of PROJECTS) {
  const r = own.find((x) => x.name === p.repo);
  Object.assign(p, { stars: r?.stargazers_count ?? 0, language: r?.language ?? "Dart", commits: await commitCount(p.repo) });
}
for (const c of CONTRIBUTIONS) c.prs = await pullRequests(c.repo);

mkdirSync(OUT, { recursive: true });
const weeks = weeksFromCal(cal);
for (const th of Object.keys(THEMES)) {
  writeFileSync(`${OUT}/title-${th}.svg`, banner(th));
  writeFileSync(`${OUT}/activity-${th}.svg`, activityPanel(weeks, cal.totalContributions, stars, th));
  SECTIONS.forEach(([slug, label]) => writeFileSync(`${OUT}/section-${slug}-${th}.svg`, sectionLabel(label, th)));
  PROJECTS.forEach((p) => writeFileSync(`${OUT}/project-${p.slug}-${th}.svg`, projectCard(p, th)));
  CONTRIBUTIONS.forEach((c) => writeFileSync(`${OUT}/contrib-${c.slug}-${th}.svg`, contribCard(c, th)));
  BUTTONS.forEach((b) => writeFileSync(`${OUT}/button-${b.toLowerCase()}-${th}.svg`, button(b, th)));
}
console.log(`wrote ${OUT}: ${cal.totalContributions} contributions, ${stars} stars`);
