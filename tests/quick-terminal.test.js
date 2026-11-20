import assert from "node:assert/strict";
import test from "node:test";
import { findLocal, folderName, session, sharedName, target } from "../mods/quick-terminal/session.js";
import { action, rebind, saveKey } from "../mods/quick-terminal/shortcut.js";

const ok = value => ({ code: 0, stdout: JSON.stringify(value) });

const shell = (cwd, folder) => ({ name: folder ? folderName(folder) : sharedName, cwd, folder });

test("adopt the shell another open started under the same name", async () => {
  const hc = async args => {
    if (args[0] === "run") return { code: 1, stderr: "name taken" };
    assert.deepEqual(args, ["ls", "--json", "--label", "mod=quick-terminal"]);
    return ok({ terminals: [{ address: "rpi/t1", name: sharedName }, { address: "t3", name: folderName("/a") },
      { address: "t4", name: sharedName }] });
  };
  assert.equal(await session(hc, shell("/elsewhere")), "t4");
});

test("keep the shared shell and folder shells apart", async () => {
  const runs = [];
  const hc = async args => {
    assert.equal(args[0], "run");
    runs.push(args);
    return ok({ address: "t9" });
  };
  assert.equal(await session(hc, shell("/repo/web", "/repo/web")), "t9");
  assert.deepEqual(runs[0], ["run", "--bg", "--json", "--no-parent", "--rm", "--name", folderName("/repo/web"),
    "--label", "mod=quick-terminal", "--label", "folder=/repo/web", "--cwd", "/repo/web"]);
});

test("two concurrent opens converge on one owned shell", async () => {
  let address;
  const hc = async args => {
    if (args[0] === "ls") return ok({ terminals: address ? [{ address, name: sharedName }] : [] });
    assert.deepEqual(args.slice(-2), ["--cwd", "/path with spaces"]);
    if (address) return { code: 1, stderr: "name taken" };
    address = "t42";
    return ok({ address });
  };
  const spec = shell("/path with spaces");
  assert.deepEqual(await Promise.all([session(hc, spec), session(hc, spec)]), ["t42", "t42"]);
});

test("report an unavailable folder without adopting another terminal", async () => {
  const hc = async args => args[0] === "ls"
    ? ok({ terminals: [{ address: "t5", name: folderName("/other") }] })
    : { code: 1, stderr: "missing folder" };
  await assert.rejects(session(hc, shell("/gone", "/gone")), /missing folder/);
});

test("find a live local shell by name without hc", () => {
  const list = [{ address: "rpi/t1", name: sharedName }, { address: "t2", name: sharedName, state: "exited" },
    { address: "t3", name: folderName("/a") }, { address: "t4", name: sharedName, state: "live" }];
  assert.equal(findLocal(list, sharedName), "t4");
  assert.equal(findLocal(list, folderName("/a")), "t3");
  assert.equal(findLocal(list, folderName("/b")), undefined);
});

test("name folder shells stably within hc's limits", () => {
  for (const path of ["/", "/Users/me/code/acme-web", "/naïve café/with spaces", "/x".repeat(500)]) {
    const name = folderName(path);
    assert.match(name, /^[a-z0-9_-]{1,32}$/);
    assert.equal(folderName(path), name);
  }
  assert.notEqual(folderName("/repo/web"), folderName("/repo/api"));
});

test("pick the focused local terminal's folder only when following", () => {
  const terminals = [{ address: "t7", cwd: "/start", foreground: { cwd: "/repo/web/src" } }];
  const base = { focused: { terminal: "t7", cwd: null }, terminals, startFolder: "/home" };
  assert.deepEqual(target({ ...base, follow: false }), { name: sharedName, cwd: "/home" });
  assert.deepEqual(target({ ...base, follow: true }),
    { name: folderName("/repo/web/src"), cwd: "/repo/web/src", folder: "/repo/web/src" });
  assert.equal(target({ ...base, follow: true, focused: { terminal: "t7", cwd: "/repo/api" } }).cwd, "/repo/api");
  for (const focused of [null, { terminal: null, cwd: "/x" }, { terminal: "rpi/t2", cwd: "/home/pi" }]) {
    assert.deepEqual(target({ ...base, follow: true, focused }), { name: sharedName, cwd: "/home" });
  }
  assert.deepEqual(target({ follow: true, focused: { terminal: "t8" }, terminals: [{ address: "t8" }], startFolder: "/home" }),
    { name: sharedName, cwd: "/home" });
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

test("move the mod's binding out of other sections", () => {
  const keys = { global: { "cmd-p": "app.palette" },
    terminal: { "ctrl-`": { command: "mod.open", args: { name: "quick-terminal" } }, "cmd-c": "terminal.copy" } };
  const updated = rebind(keys, "ctrl-`");
  assert.deepEqual(updated.global, { "cmd-p": "app.palette", "ctrl-`": action });
  assert.deepEqual(updated.terminal, { "cmd-c": "terminal.copy" });
});

test("leave keys.json untouched when the shortcut is already set", async () => {
  const write = async () => assert.fail("must not write");
  assert.equal(await saveKey("keys.json", "f6", () => JSON.stringify({ global: { f6: action } }), write), false);
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
  assert.equal(await saveKey("keys.json", "f6", () => content, write), true);
  assert.deepEqual(JSON.parse(content).global, { "cmd-q": "app.quit", f6: action });
});
