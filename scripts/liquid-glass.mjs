// Evolutionary adapter: source prototype and imported identity assets remain frozen.
export function liquidGlass(template) {
  template = template.replace(
    'data-screen="{{ screenName }}"',
    'data-screen="{{ screenName }}" data-material="{{ material }}" data-motion="{{ motion }}" data-reading="{{ largeText }}"',
  );
  template = template.replace(
    '<div style="display:flex;align-items:baseline;gap:8px;margin-top:-4px">',
    '<div class="submitted-meta">',
  );
  template = template.replace(
    /<input[^>]*value="\{\{ (?:form|edit)\.(village|tehsil|district) \}\}"[^>]*>/g,
    (tag, field) =>
      tag +
      `<small class="field-place-hint">{{ locationHints.${field} }}</small>`,
  );
  const slider = `<div class="reading-control" data-glass="2">
    <label class="reading-label"><span>{{ ui.textSize }}</span><output aria-live="polite">{{ fsLabel }}</output>
      <input class="rng" type="range" min="85" max="165" step="1" value="{{ fsPct }}" onInput="{{ setFs }}" onChange="{{ setFs }}" aria-label="{{ ui.textSize }}" aria-valuetext="{{ fsLabel }}">
    </label><div class="range-limits" aria-hidden="true"><span>85%</span><span>165%</span></div>
    <p class="reading-hint">{{ ui.sliderHelp }}</p><button class="reset-size" onClick="{{ resetFs }}">{{ ui.resetSize }}</button>
  </div>`;
  const start = template.indexOf("<h3>{{ ui.textSize }}</h3>");
  const end = template.indexOf('<button class="close-preferences"', start);
  if (start < 0 || end < 0)
    throw new Error("Reading settings contract changed");
  template =
    template.slice(0, start) +
    slider +
    `
    <div class="effects-control"><button role="switch" aria-checked="{{ effectsEnabled }}" aria-label="{{ ui.effects }}" onClick="{{ toggleEffects }}"><span>{{ ui.effects }}</span><span class="switch-track" aria-hidden="true"><span></span></span></button><p>{{ ui.effectsHelp }}</p></div>
  ` +
    template.slice(end);
  const profileSlider =
    /<div style="display:flex;align-items:center;gap:10px">\s*<span[^>]*>અ<\/span>\s*<input class="rng"[^>]*>\s*<span[^>]*>અ<\/span>\s*<\/div>/;
  if (!profileSlider.test(template))
    throw new Error("Profile slider contract changed");
  template = template.replace(profileSlider, slider);
  // Restore the waiting emblem as a focal point, without claiming an approval ETA.
  template = template
    .replace("width:88px;height:88px;", "width:168px;height:168px;")
    .replace('hint-size="88px,88px"', 'hint-size="168px,168px"');
  template = template.replace(
    '<dc-import name="SunWait"',
    '<dc-import class="waiting-symbol" aria-hidden="true" name="SunWait"',
  );
  template = template
    .replaceAll('class="gu"', 'class="gu" lang="gu"')
    .replaceAll('class="en"', 'class="en" lang="en"');
  // Generated paired text uses React nodes supported by the existing renderer.
  // Accessibility attributes and form values intentionally remain plain strings.
  template = template
    .split(/(<[^>]+>)/g)
    .map((part, index) =>
      index % 2 ? part : part.replace(/\{\{ ui\./g, "{{ copy."),
    )
    .join("");
  template = template.replace(
    /(<div style="padding:1[46]px [^">]+">)(\s*<button[^>]*secretTap)/g,
    (all, tag, rest) =>
      tag.replace("<div ", '<div class="app-header" data-glass="2" ') + rest,
  );
  // Semantic surface levels: quiet content, controlled optical navigation/actions.
  template = template.replace(/<(div|section|nav|button|a)\b[^>]*>/g, (tag) => {
    if (tag.includes("data-glass=")) return tag;
    let level;
    if (tag.includes('role="dialog"')) level = 4;
    else if (
      tag.includes('class="utility-bar"') ||
      tag.includes("border-bottom:1px solid var(--gbd)")
    )
      level = 2;
    else if (tag.startsWith("<button") || tag.includes('role="button"')) {
      if (tag.includes("secretTap")) return tag;
      level =
        tag.includes("var(--grad)") ||
        tag.includes("showAllMembers") ||
        tag.includes("background:{{") ||
        /color:(#fff|white|var\(--onGrad)/.test(tag)
          ? 3
          : 2;
      if (tag.includes("village-tile") || tag.includes('class="hovlift"'))
        level = 1;
    } else if (
      tag.includes("background:var(--g)") &&
      tag.includes("backdrop-filter")
    )
      level = 1;
    else if (tag.includes('value="{{ query }}"')) level = 2;
    return level === undefined
      ? tag
      : tag.replace(">", ` data-glass="${level}">`);
  });
  template = template.replace(
    '<input value="{{ query }}"',
    '<input data-glass="2" value="{{ query }}"',
  );
  template = template.replace(
    'style="z-index:40;position:absolute;top:8px;left:8px;right:8px;',
    'class="connection-banner" style="z-index:40;',
  );
  template = template.replace(
    "{{ copy.connection }}</button>",
    '{{ copy.connection }}<sc-if value="{{ lastConfirmed }}"><span class="last-confirmed">{{ copy.lastConfirmed }}: {{ lastConfirmed }}</span></sc-if></button>',
  );
  // The busy state must not disappear into a translucent scrim or cover a retry.
  template = template.replace(
    'role="status" style="position:absolute;inset:0;z-index:50;background:var(--scrim);display:flex;align-items:center;justify-content:center;color:white"',
    'role="status" class="busy-state" style="position:absolute;inset:0;z-index:50;display:flex;align-items:center;justify-content:center"',
  );
  return template;
}
