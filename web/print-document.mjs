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
    ["નામ", "Name"],
    ["પોતાનો નંબર", "Personal number"],
    ["બીજો નંબર", "Second number"],
    ["ગામ", "Village"],
    ["તાલુકો", "Tehsil"],
    ["જિલ્લો", "District"],
  ];
  const rows = members
    .map(
      (m) =>
        `<tr>${[
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
  return `<!doctype html><html lang="${lang === "en" ? "en" : "gu"}"><head><meta charset="utf-8"><title>મહુવા ક્ષત્રિય રાજપૂત સમાજ · સમાજ સંપર્ક યાદી</title><link rel="stylesheet" href="/vendor/noto-sans-gujarati/400.css"><link rel="stylesheet" href="/vendor/manrope/400.css"><style>@page{size:A4;margin:14mm}body{font-family:'Noto Sans Gujarati',sans-serif;color:#241413}h1{font-size:20pt}small{display:block;font-size:.8em;line-height:1.6}span[lang=en],small[lang=en]{font-family:Manrope,sans-serif}table{width:100%;border-collapse:collapse;font-size:10pt}th,td{text-align:left;padding:8px;border-bottom:1px solid #bda18d;overflow-wrap:anywhere}th{background:#f7eee3}</style></head><body><h1>${pair("સમાજ સંપર્ક યાદી", "Community directory")}</h1><p>${pair(`${members.length} મંજૂર સભ્યો`, `${members.length} approved ${members.length === 1 ? "member" : "members"}`)}</p><table><thead><tr>${heads.map((h) => `<th>${pair(...h)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

// Generic printable report: title, optional summary line and any number of
// labelled tables. Used by the admin Reports tile and the archive PDF.
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
        `<h2>${escape(lang === "en" ? s.headingEn : s.headingGu)}<small>${escape(
          lang === "en" ? s.headingGu : s.headingEn,
        )} · ${s.rows.length}</small></h2>` +
        `<table><thead><tr>${s.columns
          .map((c) => `<th>${escape(lang === "en" ? c[1] : c[0])}</th>`)
          .join("")}</tr></thead><tbody>` +
        s.rows.map((r) => `<tr>${r.map(cell).join("")}</tr>`).join("") +
        `</tbody></table>`,
    )
    .join("");
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${escape(titleGu)} · ${escape(titleEn)}</title><link rel="stylesheet" href="/vendor/noto-sans-gujarati/400.css"><link rel="stylesheet" href="/vendor/manrope/400.css"><style>@page{size:A4;margin:14mm}body{font-family:'Noto Sans Gujarati',sans-serif;color:#241413}h1{font-size:20pt;margin-bottom:2pt}h1 small{display:block;font-size:.55em;font-weight:400;color:#6b4f48}h2{font-size:13pt;margin:14pt 0 6pt}h2 small{font-weight:400;font-size:.7em;color:#6b4f48;margin-left:6pt}table{width:100%;border-collapse:collapse;font-size:9.5pt}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #bda18d;overflow-wrap:anywhere}th{background:#f7eee3}p{color:#6b4f48}</style></head><body><h1>${escape(
    lang === "en" ? titleEn : titleGu,
  )}<small>${escape(lang === "en" ? titleGu : titleEn)}</small></h1>${
    summaryGu || summaryEn
      ? `<p>${escape(
          lang === "en" ? summaryEn || "" : summaryGu || "",
        )} · ${new Date().toLocaleString(lang === "en" ? "en-GB" : "gu-IN")}</p>`
      : ""
  }${tables || "<p>—</p>"}</body></html>`;
}
