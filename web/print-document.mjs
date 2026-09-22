// Shared print styling: every report is printed on the community letterhead
// — the Sun mark at the left, the community name with Mahuva-Bhavnagar
// District, and the date on the right — and every table starts with a
// serial-number column so entries can be counted on paper.
const LETTERHEAD_SUN = (() => {
  let rays = "";
  for (let i = 0; i < 16; i++) {
    const a = (i * 22.5 * Math.PI) / 180;
    const x1 = 20 + 12.5 * Math.cos(a),
      y1 = 20 + 12.5 * Math.sin(a),
      x2 = 20 + 18 * Math.cos(a),
      y2 = 20 + 18 * Math.sin(a);
    rays += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"/>`;
  }
  return `<svg viewBox="0 0 40 40" width="38" height="38" aria-hidden="true"><defs><radialGradient id="lhSun" cx="35%" cy="30%" r="80%"><stop offset="0%" stop-color="#FFE9BE"/><stop offset="55%" stop-color="#E9A13B"/><stop offset="100%" stop-color="#B2402C"/></radialGradient></defs><g stroke="#B2402C" stroke-width="2.2" stroke-linecap="round">${rays}</g><circle cx="20" cy="20" r="9.2" fill="url(#lhSun)"/></svg>`;
})();
const LETTERHEAD_STYLE = `
.letterhead{display:flex;align-items:center;justify-content:space-between;gap:16px}
.letterhead .lh-left{display:flex;align-items:center;gap:11px;min-width:0}
.letterhead .lh-name{font-size:15pt;font-weight:800;line-height:1.25}
.letterhead .lh-district{font-size:9.5pt;color:#6b4f48;font-weight:700}
.letterhead .lh-right{font-size:9.5pt;color:#241413;text-align:right;line-height:1.5;flex:0 0 auto}
.letterhead .lh-right small{color:#6b4f48;font-weight:700}
.lh-rule{border:0;border-top:2.5px solid #B2402C;margin:8px 0 4px}
.report-title{font-size:13pt;margin:10pt 0 2pt}
.report-summary{color:#6b4f48;font-size:9.5pt;margin:0 0 8pt}
`;
function letterhead(lang) {
  const name =
    lang === "en" ? "Mahuva Kshatriya Rajput Samaj" : "મહુવા ક્ષત્રિય રાજપૂત સમાજ";
  const district =
    lang === "en" ? "Mahuva-Bhavnagar District" : "મહુવા-ભાવનગર જિલ્લો";
  const dateLabel = lang === "en" ? "Date" : "તારીખ";
  const date = new Date().toLocaleDateString(
    lang === "en" ? "en-GB" : "gu-IN",
    { day: "2-digit", month: "2-digit", year: "numeric" },
  );
  return `<header class="letterhead"><div class="lh-left">${LETTERHEAD_SUN}<div><div class="lh-name">${name}</div><div class="lh-district">${district}</div></div></div><div class="lh-right"><small>${dateLabel}</small><br>${date}</div></header><hr class="lh-rule">`;
}
const SERIAL = ["ક્રમ", "#"];

export function printDocument(members, lang = "gu") {
  lang = lang === "en" ? "en" : "gu";
  const escape = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const pair = (gu, en) => {
    if (!gu || !en || gu === en) return escape(gu || en || "—");
    const values = { gu, en },
      other = lang === "gu" ? "en" : "gu";
    return `<span lang="${lang}">${escape(values[lang])}</span><small lang="${other}">${escape(values[other])}</small>`;
  };
  const heads = [
    SERIAL,
    ["નામ", "Name"],
    ["પોતાનો નંબર", "Personal number"],
    ["બીજો નંબર", "Second number"],
    ["ગામ", "Village"],
    ["તાલુકો", "Tehsil"],
    ["જિલ્લો", "District"],
  ];
  const rows = members
    .map(
      (m, i) =>
        `<tr>${[
          String(i + 1),
          pair(m.nameGu, m.name),
          escape(m.phone),
          escape(m.phone2 || "—"),
          ...["village", "tehsil", "district"].map((k) =>
            pair(m[k + "Gu"] || m[k], m[k + "En"] || m[k]),
          ),
        ]
          .map((value) => `<td>${value}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `<!doctype html><html lang="${lang === "en" ? "en" : "gu"}"><head><meta charset="utf-8"><title>મહુવા ક્ષત્રિય રાજપૂત સમાજ · સમાજ સંપર્ક યાદી</title><link rel="stylesheet" href="/vendor/noto-sans-gujarati/400.css"><link rel="stylesheet" href="/vendor/manrope/400.css"><style>@page{size:A4;margin:14mm}body{font-family:'Noto Sans Gujarati',sans-serif;color:#241413}${LETTERHEAD_STYLE}small{display:block;font-size:.8em;line-height:1.6}span[lang=en],small[lang=en]{font-family:Manrope,sans-serif}table{width:100%;border-collapse:collapse;font-size:10pt}th,td{text-align:left;padding:8px;border-bottom:1px solid #bda18d;overflow-wrap:anywhere}th{background:#f7eee3}td:first-child,th:first-child{white-space:nowrap}</style></head><body>${letterhead(lang)}<h1 class="report-title">${pair("સમાજ સંપર્ક યાદી", "Community directory")}</h1><p class="report-summary">${pair(`${members.length} મંજૂર સભ્યો`, `${members.length} approved ${members.length === 1 ? "member" : "members"}`)}</p><table><thead><tr>${heads.map((h) => `<th>${pair(...h)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

// Generic printable report: community letterhead, report title, optional
// summary line and any number of labelled tables. Every table starts with
// a serial-number column. Used by the admin Reports tile and the archive PDF.
export function reportDocument(
  { titleGu, titleEn, summaryGu, summaryEn, sections = [] },
  lang = "gu",
) {
  lang = lang === "en" ? "en" : "gu";
  const escape = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
    );
  const cell = (value) =>
    `<td>${escape(value === "" || value === undefined ? "—" : value)}</td>`;
  const tables = sections
    .filter((s) => s.rows.length)
    .map(
      (s) =>
        `<h2 class="report-title">${escape(lang === "en" ? s.headingEn : s.headingGu)}<small>${escape(
          lang === "en" ? s.headingGu : s.headingEn,
        )} · ${s.rows.length}</small></h2>` +
        `<table><thead><tr>${[SERIAL, ...s.columns]
          .map((c) => `<th>${escape(lang === "en" ? c[1] : c[0])}</th>`)
          .join("")}</tr></thead><tbody>` +
        s.rows
          .map(
            (r, i) =>
              `<tr>${[`<td>${i + 1}</td>`, ...r.map(cell)].join("")}</tr>`,
          )
          .join("") +
        `</tbody></table>`,
    )
    .join("");
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${escape(titleGu)} · ${escape(titleEn)}</title><link rel="stylesheet" href="/vendor/noto-sans-gujarati/400.css"><link rel="stylesheet" href="/vendor/manrope/400.css"><style>@page{size:A4;margin:14mm}body{font-family:'Noto Sans Gujarati',sans-serif;color:#241413}${LETTERHEAD_STYLE}h2 small{font-weight:400;font-size:.7em;color:#6b4f48;margin-left:6pt}table{width:100%;border-collapse:collapse;font-size:9.5pt}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #bda18d;overflow-wrap:anywhere}th{background:#f7eee3}td:first-child,th:first-child{white-space:nowrap}p{color:#6b4f48}</style></head><body>${letterhead(lang)}<h1 class="report-title">${escape(
    lang === "en" ? titleEn : titleGu,
  )}<small>${escape(lang === "en" ? titleGu : titleEn)}</small></h1>${
    summaryGu || summaryEn
      ? `<p class="report-summary">${escape(
          lang === "en" ? summaryEn || "" : summaryGu || "",
        )}</p>`
      : ""
  }${tables || "<p>—</p>"}</body></html>`;
}
