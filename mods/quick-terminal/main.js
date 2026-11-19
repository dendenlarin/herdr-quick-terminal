import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { appHome, closeOverlay, focused, hc, home, keys, openOverlay, pickFolder,
  props, readTextFile, setShared, shared, terminals, theme, writeTextFile } from "herdr";
import { session } from "./session.js";
import { action, saveKey } from "./shortcut.js";

const folderSetting = "quick-terminal.folder";
const folder = () => shared(folderSetting) || home();

function displayPath(path) {
  if (path === home()) return "~";
  return path.startsWith(home() + "/") ? "~" + path.slice(home().length) : path;
}

function button(id, label, click, tip) {
  const t = theme();
  const element = div().id(id).rounded(5).px(8).py(4).text_size(12).text_color(t.muted)
    .cursor_pointer().hover(s => s.bg(t.hover).text_color(t.foreground)).on_click(click).child(label);
  return tip ? element.tooltip(tip) : element;
}

export default class QuickTerminal extends View {
  init(_props, cx) {
    const p = props() ?? {};
    this.handle = cx.focus_handle();
    if (p.role === "settings") {
      // Bound app actions run before on_key_down. Shadow them only while recording.
      const occupied = new Set(keys().map(binding => binding.keys.split(" ")[0]));
      occupied.add("ctrl-alt-shift-escape");
      occupied.delete("escape");
      cx.bind_keys([...occupied].map(keystroke => ({
        keystroke, action: "quick_terminal_taken", context: "QuickTerminalRecorder"
      })));
      cx.bind_keys([{ keystroke: "escape", action: "quick_terminal_cancel", context: "QuickTerminalRecorder" }]);
    }
    if (p.overlay && !p.role) this.start(cx);
  }

  start(cx, cwd = folder()) {
    if (this.busy) return;
    this.busy = true;
    this.error = "";
    cx.spawn(async cx => {
      try {
        const terminal = await session(hc, cwd);
        if (this.closed) return;
        const remote = focused()?.space?.includes("/");
        this.child = openOverlay({
          kind: "dialog", modal: true, width: 0.7, height: 0.6,
          layout: { type: "column", resizable: false, children: [
            { type: "block", size: { px: 34 }, content: { mod: "quick-terminal",
              props: { role: "header", terminal, owner: props().overlay, remote } } },
            { type: "block", content: { terminal } }
          ] }
        });
      } catch (error) { this.error = String(error); }
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
          if (retry) this.start(cx, path);
        }
      } catch (error) { this.error = String(error); }
      cx.notify();
    });
  }

  header(p, t) {
    const term = terminals().find(item => item.address === p.terminal);
    const path = term?.foreground?.cwd || term?.cwd || folder();
    return h_flex().size_full().items_center().gap(6).px(10).bg(t.chrome)
      .border_b(1).border_color(t.border).text_size(12)
      .child(svg("mods/quick-terminal/terminal.svg").size(15).flex_none().text_color(t.accent))
      .when(p.remote, el => el.child(div().text_color(t.muted).child("Local")))
      .child(div().flex_1().truncate().text_color(t.foreground).child(displayPath(path)))
      .child(button("settings", "⚙", () => {
        if (this.child) closeOverlay(this.child);
        this.child = openOverlay({ mod: "quick-terminal", kind: "dialog", width: 390,
          props: { role: "settings", terminal: p.terminal } });
      }, "Quick Terminal settings"))
      .child(button("hide", "×", () => closeOverlay(p.overlay), "Hide terminal"));
  }

  capture(event, cx) {
    if (!this.recording) return;
    cx.stop_propagation();
    if (event.is_held) return;
    if (event.key === "escape") {
      this.recording = false;
      cx.notify();
      return;
    }
    const key = event.keystroke;
    if (!/(^|-)(ctrl|alt|cmd)-/.test(key) && !/^f\d+$/.test(key)) {
      this.error = "Choose a shortcut with Ctrl, Alt, Command, or a function key.";
      cx.notify();
      return;
    }
    this.recording = false;
    cx.spawn(async cx => {
      try {
        await saveKey(appHome() + "/keys.json", key, readTextFile, writeTextFile);
        this.error = "";
      } catch (error) { this.error = String(error); }
      cx.notify();
    });
  }

  settings(p, t) {
    const binding = keys().find(k => k.section === "global" && k.action === action);
    return v_flex().id("settings").track_focus(this.handle)
      .when(this.recording, el => el.key_context("QuickTerminalRecorder")
        .on_action("quick_terminal_taken", (_e, cx) => {
          this.error = "Already assigned. Press another shortcut.";
          cx.stop_propagation();
          cx.notify();
        })
        .on_action("quick_terminal_cancel", (_e, cx) => {
          this.recording = false;
          this.error = "";
          cx.stop_propagation();
          cx.notify();
        }))
      .on_key_down((e, cx) => this.capture(e, cx))
      .bg(t.popover).p(16).gap(12).text_size(13).text_color(t.foreground)
      .child(h_flex().items_center().justify_between().child(div().font_semibold().child("Quick Terminal"))
        .child(button("done", "Done", () => closeOverlay(p.overlay))))
      .child(h_flex().items_center().justify_between().child("Starting folder")
        .child(button("folder", displayPath(folder()), (_e, cx) => this.chooseFolder(cx), folder())))
      .child(h_flex().items_center().justify_between().child("Shortcut")
        .child(button("key", this.recording ? "Press shortcut…" : binding?.keys || "Set shortcut", (_e, cx) => {
          this.error = "";
          this.recording = true;
          this.handle.focus();
          cx.notify();
        })))
      .when(Boolean(this.error), el => el.child(div().text_color(t.blocked).child(this.error)));
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
        .child(button("home", "Open in home", (_e, cx) => this.start(cx, home())))
        .child(button("dismiss", "Close", () => closeOverlay(p.overlay))));
  }
}
