import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, Checkbox } from "gpui-base";
import { appHome, closeOverlay, exec, focused, hc, home, keys, openOverlay, pickFolder, props,
  readTextFile, setShared, shared, spaces, terminals, theme, window, writeTextFile } from "herdr";
import { session, sharedName, target } from "./session.js";
import { action, reserved, saveKey } from "./shortcut.js";

const repo = "https://github.com/dendenlarin/herdr-quick-terminal";
const folderSetting = "quick-terminal.folder";
const followSetting = "quick-terminal.follow";
const folder = () => shared(folderSetting) || home();
const follows = () => shared(followSetting) === true;
const quickShells = () => terminals().filter(t => t.labels?.mod === "quick-terminal" && !t.address.includes("/"));
const icon = name => "mods/quick-terminal/" + name + ".svg";
const message = error => error?.message ?? String(error);

// The keymap is app-wide and bindings can't be removed, so each chord is shadowed once.
// While recording, a bound chord reaches the recorder instead of its app action.
const recorder = "QuickTerminalRecorder";
const shadowed = new Set();
const shadow = key => "quick_terminal_key:" + key;

function displayPath(path) {
  if (path === home()) return "~";
  return path.startsWith(home() + "/") ? "~" + path.slice(home().length) : path;
}

// Opens a link in the system browser: Herdr has no command for this.
function openLink(url) {
  const os = window()?.platform;
  const [cmd, args] = os === "windows" ? ["cmd", ["/c", "start", "", url]] : [os === "linux" ? "xdg-open" : "open", [url]];
  exec(cmd, args).catch(() => {});
}

// Controls stop the press so the launcher window doesn't start a drag instead of a click.
function control(element, click, tip) {
  const t = theme();
  element = element.rounded(5).text_color(t.muted).cursor_pointer()
    .hover(s => s.bg(t.hover).text_color(t.foreground))
    .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click(click);
  return tip ? element.tooltip(tip) : element;
}

const button = (id, label, click, tip) =>
  control(div().id(id).px(8).py(4).text_size(12).child(label), click, tip);

const iconButton = (id, name, click, tip) =>
  control(div().id(id).size(24).flex().flex_none().items_center().justify_center()
    .child(svg(icon(name)).size(14)), click, tip);

export default class QuickTerminal extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    const p = props() ?? {};
    if (p.overlay && !p.role) {
      this.start(cx, target({ follow: follows(), focused: focused(), terminals: terminals(), startFolder: folder() }));
    }
  }

  // spec: { name, cwd, folder? } from target(); retries open the shared shell.
  start(cx, spec) {
    if (this.busy) return;
    this.busy = true;
    this.error = "";
    cx.spawn(async cx => {
      try {
        const terminal = await session(hc, spec);
        if (this.closed) return;
        const space = spaces().find(s => s.id === focused()?.space);
        this.child = openOverlay({
          kind: "dialog", modal: true, width: 0.7, height: 0.6,
          layout: { type: "column", resizable: false, children: [
            { type: "block", size: { px: 34 }, content: { mod: "quick-terminal",
              props: { role: "header", terminal, owner: props().overlay, remote: Boolean(space?.machine) } } },
            { type: "block", content: { terminal } }
          ] }
        });
      } catch (error) { this.error = message(error); }
      this.busy = false;
      cx.notify();
    });
  }

  close() {
    this.closed = true;
    if (this.child) closeOverlay(this.child);
    if (props()?.role === "header") closeOverlay(props().owner);
  }

  chooseFolder(cx, retry = false) {
    cx.spawn(async cx => {
      try {
        const path = await pickFolder({ prompt: "Use starting folder" });
        if (path) {
          setShared(folderSetting, path);
          if (retry) this.start(cx, { name: sharedName, cwd: path });
        }
      } catch (error) { this.error = message(error); }
      cx.notify();
    });
  }

  header(p, t) {
    const term = terminals().find(item => item.address === p.terminal);
    const path = term?.foreground?.cwd || term?.cwd || folder();
    return h_flex().size_full().items_center().gap(6).pl(10).pr(5).bg(t.chrome)
      .border_b(1).border_color(t.border).text_size(12)
      .child(svg(icon("terminal")).size(15).flex_none().text_color(t.accent))
      .when(p.remote, el => el.child(div().text_color(t.muted).child("Local")))
      .child(div().flex_1().truncate().text_color(t.foreground).child(displayPath(path)))
      .child(iconButton("settings", "settings", () => {
        if (this.child) closeOverlay(this.child);
        this.child = openOverlay({ mod: "quick-terminal", kind: "dialog", width: 390,
          props: { role: "settings", terminal: p.terminal } });
      }, "Quick Terminal settings"))
      .child(iconButton("hide", "close", () => closeOverlay(p.overlay), "Hide terminal"));
  }

  startRecording(cx) {
    const fresh = [...new Set(keys().map(binding => binding.keys.split(" ")[0]))]
      .filter(key => key !== "escape" && key !== reserved && !shadowed.has(key));
    const bindings = fresh.map(key => ({ keystroke: key, action: shadow(key), context: recorder }));
    if (!shadowed.has("escape")) bindings.push({ keystroke: "escape", action: "quick_terminal_cancel", context: recorder });
    if (bindings.length) cx.bind_keys(bindings);
    fresh.forEach(key => shadowed.add(key));
    shadowed.add("escape");
    this.error = "";
    this.recording = true;
    this.handle.focus();
    cx.notify();
  }

  // keys.json decides: a chord shadowed earlier but free now is accepted.
  record(key, cx) {
    if (!/(^|-)(ctrl|alt|cmd)-/.test(key) && !/^f\d+$/.test(key)) {
      this.error = "Choose a shortcut with Ctrl, Alt, Command, or a function key.";
      cx.notify();
      return;
    }
    if (this.saving) return;
    this.saving = true;
    cx.spawn(async cx => {
      try {
        await saveKey(appHome() + "/keys.json", key, readTextFile, writeTextFile);
        this.recording = false;
        this.error = "";
      } catch (error) { this.error = message(error) + " Press another shortcut."; }
      this.saving = false;
      cx.notify();
    });
  }

  settings(p, t) {
    const mine = keys().filter(k => k.action === action);
    const binding = mine.find(k => k.section === "global") ?? mine[0];
    const live = terminals().some(item => item.address === p.terminal);
    const row = (label, value) => h_flex().items_center().justify_between().child(label).child(value);
    let root = v_flex().id("settings").track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (!this.recording) return;
        cx.stop_propagation();
        if (!e.is_held) this.record(e.keystroke, cx);
      });
    if (this.recording) {
      root = root.key_context(recorder).on_action("quick_terminal_cancel", (_e, cx) => {
        this.recording = false;
        this.error = "";
        cx.stop_propagation();
        cx.notify();
      });
      for (const key of shadowed) {
        if (key !== "escape") root = root.on_action(shadow(key), (_e, cx) => {
          cx.stop_propagation();
          this.record(key, cx);
        });
      }
    }
    const follow = follows();
    const others = quickShells().filter(item => item.address !== p.terminal);
    const check = Checkbox.new("follow").checked(follow)
      .flex().items_start().gap(10).px(8).py(7).mx(-8).rounded(6).cursor_pointer()
      .hover(s => s.bg(t.hover))
      .on_change((checked, cx) => { setShared(followSetting, checked); cx.notify(); })
      .child(div().size(16).mt(1).flex_none().flex().items_center().justify_center().rounded(4)
        .border(1).border_color(follow ? t.accent : t.muted).bg(follow ? t.accent : t.background)
        .when(follow, el => el.child(svg(icon("check")).size(12).text_color(t.background))))
      .child(v_flex().gap(2)
        .child(div().child("Open in the focused terminal's folder"))
        .child(div().text_size(12).text_color(t.dim).child("Each folder keeps its own shell.")));
    return root.bg(t.popover).p(16).gap(12).text_size(13).text_color(t.foreground)
      .child(h_flex().items_center().gap(4)
        .child(div().flex_1().font_semibold().child("Quick Terminal"))
        .child(iconButton("repo", "github", () => openLink(repo), "Quick Terminal on GitHub"))
        .child(button("done", "Done", () => closeOverlay(p.overlay))))
      .child(check)
      .child(row(follow ? "Fallback folder" : "Starting folder",
        button("folder", displayPath(folder()), (_e, cx) => this.chooseFolder(cx),
          follow ? "Used when the focused terminal is remote or has no folder: " + folder() : folder())))
      .child(row("Shortcut", button("key", this.recording ? "Press shortcut…" : binding?.keys || "Set shortcut",
        (_e, cx) => this.startRecording(cx))))
      .when(Boolean(this.recording), el => el.child(div().text_size(12).text_color(t.dim)
        .child("Esc cancels. Saving rewrites keys.json: Herdr then stops adding its new default shortcuts to it.")))
      .when(live || others.length > 0, el => el.child(row("Shell", h_flex().gap(2)
        .when(others.length > 0, el => el.child(button("others", "End " + others.length + (others.length === 1 ? " other" : " others"), () => {
          for (const item of others) hc(["kill", item.address]).catch(() => {});
        }, "Close the other Quick Terminal shells: " + others.map(item => displayPath(item.foreground?.cwd || item.cwd || "")).join(", "))))
        .when(live, el => el.child(button("end", "End shell", () => {
          hc(["kill", p.terminal]).catch(() => {});
        }, "Close this shell. The next open starts a fresh one."))))))
      .when(Boolean(this.error), el => el.child(div().text_size(12).text_color(t.blocked).child(this.error)));
  }

  render() {
    const p = props() || {}, t = theme();
    if (p.role === "header") return this.header(p, t);
    if (p.role === "settings") return this.settings(p, t);
    if (!this.error) return div();
    return v_flex().bg(t.popover).rounded(10).p(14).gap(8).text_size(13).text_color(t.foreground)
      .child(div().font_semibold().child("Could not open Quick Terminal"))
      .child(div().text_color(t.muted).child(displayPath(folder())))
      .child(div().text_size(12).child(this.error))
      .child(h_flex().gap(6)
        .child(button("choose", "Choose folder", (_e, cx) => this.chooseFolder(cx, true)))
        .child(button("home", "Open in home", (_e, cx) => this.start(cx, { name: sharedName, cwd: home() })))
        .child(button("dismiss", "Close", () => closeOverlay(p.overlay))));
  }
}
