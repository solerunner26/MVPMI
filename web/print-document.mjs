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
