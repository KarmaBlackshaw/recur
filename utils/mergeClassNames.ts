// Joins Tailwind class lists so a later class replaces an earlier one from the same group
// (a caller's `text-paid` replaces a variant's `text-white`). NativeWind resolves conflicting
// classes by stylesheet order, not className order, so plain concatenation can't override.
// Covers the utility groups AppText variants and callers use; other classes pass through.

const SIDES: Record<string, string[]> = { "": ["x", "y", "s", "e", "t", "r", "b", "l"], x: ["r", "l"], y: ["t", "b"] };

function classGroup(utility: string): { group: string; overrides: string[] } | null {
  if (/^text-(left|center|right|justify|start|end)$/.test(utility)) {
    return { group: "text-align", overrides: [] };
  }
  if (/^text-(wrap|nowrap|balance|pretty)$/.test(utility)) {
    return { group: "text-wrap", overrides: [] };
  }
  if (/^(truncate|text-ellipsis|text-clip)$/.test(utility)) {
    return { group: "text-overflow", overrides: [] };
  }
  if (/^text-(xs|sm|base|lg|[2-9]?xl|\[[\d.]+(px|rem|em)\])$/.test(utility)) {
    return { group: "font-size", overrides: ["leading"] };
  }
  if (utility.startsWith("text-")) {
    return { group: "text-color", overrides: [] };
  }
  if (/^(uppercase|lowercase|capitalize|normal-case)$/.test(utility)) {
    return { group: "text-transform", overrides: [] };
  }
  if (/^(underline|overline|line-through|no-underline)$/.test(utility)) {
    return { group: "text-decoration", overrides: [] };
  }
  if (/^(italic|not-italic)$/.test(utility)) {
    return { group: "font-style", overrides: [] };
  }
  if (/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\[\d+\])$/.test(utility)) {
    return { group: "font-weight", overrides: [] };
  }
  if (utility.startsWith("font-")) {
    return { group: "font-family", overrides: [] };
  }
  if (/^flex-(row|col)(-reverse)?$/.test(utility)) {
    return { group: "flex-direction", overrides: [] };
  }
  const prefixed = /^(tracking|leading|opacity|shrink|grow|self)(-|$)/.exec(utility);
  if (prefixed) {
    return { group: prefixed[1], overrides: [] };
  }
  if (/^flex-(1|auto|initial|none|\[.+\])$/.test(utility)) {
    return { group: "flex", overrides: ["grow", "shrink", "basis"] };
  }
  const spacing = /^-?([mp])([xyserbtl]?)-/.exec(utility);
  if (spacing) {
    const [, kind, side] = spacing;
    return { group: kind + side, overrides: (SIDES[side] ?? []).map((s) => kind + s) };
  }
  return null;
}

// "ios:text-sm" → ["ios:", "text-sm"]; a colon inside an arbitrary value like "text-[color:red]" isn't a modifier.
function splitModifiers(cls: string): [string, string] {
  let depth = 0;
  for (let i = cls.length - 1; i >= 0; i--) {
    if (cls[i] === "]") {
      depth++;
    } else if (cls[i] === "[") {
      depth--;
    } else if (cls[i] === ":" && depth === 0) {
      return [cls.slice(0, i + 1), cls.slice(i + 1)];
    }
  }
  return ["", cls];
}

export function mergeClassNames(...classLists: (string | undefined)[]): string {
  const classes = classLists.join(" ").split(/\s+/).filter(Boolean);
  const taken = new Set<string>();
  const kept: string[] = [];
  for (let i = classes.length - 1; i >= 0; i--) {
    const cls = classes[i];
    const [modifiers, utility] = splitModifiers(cls);
    const info = classGroup(utility);
    if (info) {
      if (taken.has(modifiers + info.group)) {
        continue;
      }
      taken.add(modifiers + info.group);
      info.overrides.forEach((group) => taken.add(modifiers + group));
    }
    kept.push(cls);
  }
  return kept.reverse().join(" ");
}
