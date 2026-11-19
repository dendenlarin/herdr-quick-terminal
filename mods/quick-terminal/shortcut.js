export const action = "mod.open:quick-terminal";

function owned(value) {
  return value === action || (value?.command === "mod.open" && value.args?.name === "quick-terminal");
}

export function rebind(bindings, key) {
  if (key === "ctrl-alt-shift-escape") throw new Error("Herdr reserves this shortcut.");
  for (const [section, entries] of Object.entries(bindings)) {
    if (Object.keys(entries).some(chord => chord.split(" ")[0] === key &&
      !(chord === key && section === "global" && owned(entries[key])))) {
      throw new Error(key + " is already assigned in " + section + ".");
    }
  }
  const global = { ...bindings.global };
  for (const [old, value] of Object.entries(global)) {
    if (owned(value)) delete global[old];
  }
  global[key] = action;
  return { ...bindings, global };
}

export async function saveKey(path, key, read, write) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const previous = await read(path);
    if (previous === null) throw new Error("Open Herdr once to create keys.json.");
    const updated = rebind(JSON.parse(previous), key);
    try {
      await write(path, JSON.stringify(updated, null, 2) + "\n", previous);
      return;
    } catch (error) {
      if (attempt || !String(error).includes("changed")) throw error;
    }
  }
}
