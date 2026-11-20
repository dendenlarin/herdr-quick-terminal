const label = "mod=quick-terminal";
export const sharedName = "herdr-quick-terminal";

// A stable hc name per folder: hc names are 1-32 of a-z 0-9 - _.
export function folderName(path) {
  let hash = 0x811c9dc5;
  for (const char of path) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return "quick-terminal-" + hash.toString(16).padStart(8, "0");
}

// Which shell to open: the focused local terminal's folder when following, else the shared one.
export function target({ follow, focused, terminals, startFolder }) {
  const shared = { name: sharedName, cwd: startFolder };
  if (!follow || !focused?.terminal || focused.terminal.includes("/")) return shared;
  const term = terminals.find(item => item.address === focused.terminal);
  const dir = focused.cwd || term?.foreground?.cwd || term?.cwd;
  return dir ? { name: folderName(dir), cwd: dir, folder: dir } : shared;
}

async function find(hc, name) {
  const result = await hc(["ls", "--json", "--label", label]);
  if (result.code !== 0) throw new Error(result.stderr || result.stdout);
  return JSON.parse(result.stdout).terminals
    .find(t => t.name === name && !t.address.includes("/"))?.address;
}

// Core enforces unique live names even across overlapping mod instances.
export async function session(hc, { name, cwd, folder }) {
  const existing = await find(hc, name);
  if (existing) return existing;
  const labels = ["--label", label, ...(folder ? ["--label", "folder=" + folder] : [])];
  const result = await hc(["run", "--bg", "--json", "--no-parent", "--rm",
    "--name", name, ...labels, "--cwd", cwd]);
  if (result.code === 0) {
    const address = JSON.parse(result.stdout).address;
    if (address) return address;
  }
  const concurrent = await find(hc, name);
  if (concurrent) return concurrent;
  throw new Error(result.stderr || result.stdout || "Could not start the shell.");
}
