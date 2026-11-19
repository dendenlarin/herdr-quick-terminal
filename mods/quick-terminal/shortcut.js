export const action = "mod.open:quick-terminal";
export const reserved = "ctrl-alt-shift-escape";

export function owned(value) {
  return value === action || (value?.command === "mod.open" && value.args?.name === "quick-terminal");
}

// Moves the mod's binding to `key` in the global section. Bindings of this mod in any
// section are replaced; any other use of `key` (also as the start of a sequence) is a conflict.
export function rebind(bindings, key) {
  if (key === reserved) throw new Error("Herdr reserves this shortcut.");
  /** @type {Record<string, Record<string, unknown>>} */
  const updated = {};
  for (const [section, entries] of Object.entries(bindings)) {
    updated[section] = {};
    for (const [chord, value] of Object.entries(entries)) {
      if (owned(value)) continue;
      if (chord.split(" ")[0] === key) throw new Error(key + " is already assigned in " + section + ".");
      updated[section][chord] = value;
    }
  }
  updated.global = { ...updated.global, [key]: action };
  return updated;
}

// Returns false when `key` already was the shortcut, so keys.json stays untouched.
export async function saveKey(path, key, read, write) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const previous = await read(path);
    if (previous === null) throw new Error("Open Herdr once to create keys.json.");
    const bindings = JSON.parse(previous);
    if (owned(bindings.global?.[key])) return false;
    const updated = rebind(bindings, key);
    try {
      await write(path, JSON.stringify(updated, null, 2) + "\n", previous);
      return true;
    } catch (error) {
      if (attempt || !String(error).includes("changed")) throw error;
    }
  }
}
