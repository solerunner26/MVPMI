export function printDocument(members, lang = "gu") {
  const english = lang === "en";
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
  const title = english ? "Community directory" : "સમાજ સંપર્ક યાદી";
  const heads = english
    ? [
        "Name",
        "Personal number",
        "Second number",
        "Village",
        "Tehsil",
        "District",
      ]
    : ["નામ", "પોતાનો નંબર", "બીજો નંબર", "ગામ", "તાલુકો", "જિલ્લો"];
  const rows = members
    .map(
      (m) =>
        `<tr>${[english ? m.name || m.nameGu : m.nameGu || m.name, m.phone, m.phone2 || "—", m.village, m.tehsil, m.district].map((value) => `<td>${escape(value)}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<!doctype html><html lang="${english ? "en" : "gu"}"><head><meta charset="utf-8"><title>${title}</title><link rel="stylesheet" href="/vendor/noto-sans-gujarati/400.css"><style>@page{size:A4;margin:14mm}body{font-family:'Noto Sans Gujarati',sans-serif;color:#241413}h1{font-size:20pt}table{width:100%;border-collapse:collapse;font-size:10pt}th,td{text-align:left;padding:8px;border-bottom:1px solid #ddd;overflow-wrap:anywhere}th{background:#f7eee3}</style></head><body><h1>${title}</h1><p>${members.length} ${english ? "approved members" : "મંજૂર સભ્યો"}</p><table><thead><tr>${heads.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
}
