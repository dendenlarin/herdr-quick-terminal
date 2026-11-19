import assert from "node:assert/strict";
import test from "node:test";
import { session } from "../mods/quick-terminal/session.js";
import { action, rebind, saveKey } from "../mods/quick-terminal/shortcut.js";

const ok = value => ({ code: 0, stdout: JSON.stringify(value) });

test("reuse the local terminal across folder changes", async () => {
  const hc = async args => {
    assert.deepEqual(args, ["ls", "--json", "--label", "mod=quick-terminal"]);
    return ok({ terminals: [{ address: "remote/t1" }, { address: "t4" }] });
  };
  assert.equal(await session(hc, "/elsewhere"), "t4");
});

test("two concurrent opens converge on one owned shell", async () => {
  let address;
  const hc = async args => {
    if (args[0] === "ls") return ok({ terminals: address ? [{ address }] : [] });
    assert.deepEqual(args.slice(-2), ["--cwd", "/path with spaces"]);
    if (address) return { code: 1, stderr: "name taken" };
    address = "t42";
    return ok({ address });
  };
  assert.deepEqual(await Promise.all([session(hc, "/path with spaces"), session(hc, "/path with spaces")]), ["t42", "t42"]);
});

test("report an unavailable folder without adopting another terminal", async () => {
  const hc = async args => args[0] === "ls" ? ok({ terminals: [] }) : { code: 1, stderr: "missing folder" };
  await assert.rejects(session(hc, "/gone"), /missing folder/);
});

test("preserve unrelated keys and reject context and sequence conflicts", () => {
  const keys = { global: { "ctrl-q": action, "cmd-p": "app.palette" },
    terminal: { "cmd-k cmd-s": "terminal.copy", "cmd-c": "terminal.copy" } };
  const updated = rebind(keys, "f6");
  assert.deepEqual(updated.global, { "cmd-p": "app.palette", f6: action });
  assert.deepEqual(updated.terminal, keys.terminal);
  for (const chord of ["cmd-k", "cmd-c", "cmd-p", "ctrl-alt-shift-escape"]) {
    assert.throws(() => rebind(keys, chord));
  }
});

test("reload after a concurrent keys.json change before saving", async () => {
  let content = '{"global":{}}';
  const write = async (_path, text, previous) => {
    if (!content.includes("cmd-q")) {
      content = '{"global":{"cmd-q":"app.quit"}}';
      throw new Error("The file changed while saving.");
    }
    assert.equal(previous, content);
    content = text;
  };
  await saveKey("keys.json", "f6", () => content, write);
  assert.deepEqual(JSON.parse(content).global, { "cmd-q": "app.quit", f6: action });
});
