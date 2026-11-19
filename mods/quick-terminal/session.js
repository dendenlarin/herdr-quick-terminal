const label = "mod=quick-terminal";
const name = "herdr-quick-terminal";

async function findSession(hc) {
  const result = await hc(["ls", "--json", "--label", label]);
  if (result.code !== 0) throw new Error(result.stderr || result.stdout);
  return JSON.parse(result.stdout).terminals.find(t => !t.address.includes("/"))?.address;
}

// Core enforces unique live names even across overlapping mod instances.
export async function session(hc, cwd) {
  const existing = await findSession(hc);
  if (existing) return existing;
  const result = await hc(["run", "--bg", "--json", "--no-parent", "--rm",
    "--name", name, "--label", label, "--cwd", cwd]);
  if (result.code === 0) {
    const address = JSON.parse(result.stdout).address;
    if (address) return address;
  }
  const concurrent = await findSession(hc);
  if (concurrent) return concurrent;
  throw new Error(result.stderr || result.stdout || "Could not start the shell.");
}
