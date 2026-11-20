# Quick Terminal

One shell for the whole window, a shortcut away: `mod.open:quick-terminal` (`` ctrl-` ``) opens a centered terminal over whatever space is shown; the same shortcut hides it. The shell lives in herdr-core, so hiding it, switching spaces or reopening Herdr keeps its output, folder and half-typed command. A gear in its header sets the starting folder and the shortcut, and can switch to one shell per folder: the terminal then opens in the folder of the terminal you were in.

![Quick Terminal](preview.png)

## What you see

- **Dialog**: a modal `dialog` overlay, 70% of the window wide and 60% high, centered, the window dimmed behind it. A column, not resizable:
  - **Header**, 34px, `chrome` background, 1px `border` along the bottom, 10px left / 5px right padding, gap 6, 12px text: a 15px terminal icon (`terminal.svg`) in `accent`; `Local` in `muted` when the shown space is on another machine; the shell's current folder in `foreground`, home shortened to `~`, truncated, filling the row; two 24px icon buttons, radius 5, 14px icons in `muted` (`hover` background and `foreground` on hover): gear (`settings.svg`, tooltip `Quick Terminal settings`) and × (`close.svg`, tooltip `Hide terminal`).
  - **Terminal**: the shell, filling the rest.
- **Settings**, a `dialog` 390px wide over it, `popover` background, 16px padding, gap 12, 13px text, rows with the label left and a text button right (12px `muted`, 8px/4px padding, radius 5, `hover` on hover):
  - `Quick Terminal` semibold, a 24px GitHub icon button (`github.svg`, tooltip `Quick Terminal on GitHub`) and `Done`.
  - A checkbox row (`Checkbox` from gpui-base), 8px/7px padding, radius 6, `hover` background: a 16px box, radius 4, 1px border (`accent` when on, `muted` off), `accent` fill with a 12px `check.svg` in `background` when on; beside it `Open in the focused terminal's folder` and under it, 12px `dim`, `Each folder keeps its own shell.`
  - `Starting folder` (`Fallback folder` while the checkbox is on): the folder with `~` for home (tooltip: the full path; while on, prefixed `Used when the focused terminal is remote or has no folder: `).
  - `Shortcut`: the bound chord as written in keys.json (`` ctrl-` ``), `Set shortcut` when none, `Press shortcut…` while recording. While recording, a 12px `dim` note: `Esc cancels. Saving rewrites keys.json: Herdr then stops adding its new default shortcuts to it.`
  - `Shell`: `End N others` while other Quick Terminal shells on this computer are live (tooltip lists their folders), and `End shell` (tooltip `Close this shell. The next open starts a fresh one.`) while this one is live.
  - Errors in 12px `blocked` at the bottom.
- **Can't start** (the starting folder is gone, herdr-core is down): a card in place of the dialog, `popover`, radius 10, 14px padding, gap 8, 13px text: `Could not open Quick Terminal` semibold, the folder in `muted`, the error in 12px, then buttons `Choose folder`, `Open in home`, `Close`.

## How it behaves

- **Shortcut**: `mod.open` toggles the mod's launcher overlay, a frameless `window` that draws nothing; opening it finds or starts the shell and opens the dialog, closing it closes the dialog. Closing the dialog with × or the shell ending closes the launcher too (Esc goes to the shell, never closes the dialog), and Herdr gives focus back to the pane underneath. The terminal gets the keyboard when the dialog opens.
- **Which shell**, decided when the shortcut is pressed: with the checkbox off (shared `quick-terminal.follow`, default off), the shared shell `herdr-quick-terminal` in the starting folder. With it on, the focused terminal's folder (`focused().cwd`, else its `foreground.cwd`, else `cwd`) and the shell named `quick-terminal-<fnv1a32 of the path, 8 hex>`, labelled `folder=<path>`; no focused terminal, a remote one (`machine/tN`) or no folder → the shared shell.
- **Finding it**: by name among `hc ls --json --label mod=quick-terminal` on this computer (addresses without a `machine/` prefix); if none, `hc run --bg --json --no-parent --rm --name <name> --label mod=quick-terminal [--label folder=<path>] --cwd <folder>`. Two opens at once: the second `run` fails on the taken name and the lookup runs again, so a name never has two shells.
- **Header folder** follows the shell live (`foreground.cwd`, else `cwd`).
- **Starting folder**: the native folder picker; stored in shared `quick-terminal.folder`; applies to the next shared shell, never moves the current one. The can't-start card's buttons open the shared shell in the chosen folder or home.
- **Recording a shortcut**: click the shortcut button, press a chord with `ctrl`, `alt` or `cmd`, or a function key. Esc cancels. Chords already bound in Herdr would run their action first, so while recording they are bound in the settings' key context to recorder actions instead. Every chord then goes through the same check against keys.json read fresh: one used in any section, also as the first key of a sequence, shows `<chord> is already assigned in <section>. Press another shortcut.` and recording goes on; the current shortcut ends recording without writing. Otherwise the mod's bindings in every section are removed and `"<chord>": "mod.open:quick-terminal"` is added to `global`, written only if the file hasn't changed since it was read (one retry after a concurrent change).
- **End shell**: `hc kill` on the shell; the dialog, header and settings close with it. **End N others**: `hc kill` on every other live shell labelled `mod=quick-terminal` on this computer.
- No agent statuses: the shell is a plain program.

## Built from

- **Mod** `mods/quick-terminal/`: `mod.json` `{ "place": "none", "title": "Quick Terminal", "overlay": { "kind": "window", "width": 380, "frame": "none" } }`; `main.js`, one `View` with three roles by `props().role`: none (the launcher, also the can't-start card), `header`, `settings`; `session.js` (`target` picks the shell, `folderName`, `session` finds or starts it through `hc`); `shortcut.js` (`rebind`, `saveKey`); icons `terminal.svg`, `settings.svg`, `close.svg`, `github.svg`, `check.svg` (Lucide).
- **Dialog**: `openOverlay({ kind: "dialog", modal: true, width: 0.7, height: 0.6, layout: { type: "column", resizable: false, children: [{ type: "block", size: { px: 34 }, content: { mod: "quick-terminal", props: { role: "header", terminal, owner, remote } } }, { type: "block", content: { terminal } }] } })`, where `owner` is the launcher's `props().overlay` and `remote` is whether the focused space has a `machine`. Settings: `openOverlay({ mod: "quick-terminal", kind: "dialog", width: 390, props: { role: "settings", terminal } })`.
- **Cleanup**: `close()` of the launcher closes the dialog; `close()` of the header closes the settings and the launcher.
- **herdr**: `hc` (`ls --json --label`, `run`, `kill`), `terminals`, `focused`, `spaces`, `keys`, `openOverlay` / `closeOverlay`, `props`, `shared` / `setShared` (`quick-terminal.folder`, `quick-terminal.follow`), `pickFolder`, `readTextFile` / `writeTextFile` (`<appHome>/keys.json`), `appHome`, `home`, `theme`, `window` and `exec` (`open` / `xdg-open` / `cmd /c start` for the GitHub link); `cx.bind_keys`, `key_context`, `on_action`, `on_key_down`.
- **keys.json** at the repo root: `{ "global": { "ctrl-`": "mod.open:quick-terminal" } }`.
- `Checkbox` from gpui-base (`checked`, `on_change`).
- Tests: `npm test` (Node 20+, `node:test`) for `session.js` and `shortcut.js`.

## Watch out

- Write `mod.json` (`"place": "none"`) before `main.js`: a new mod folder without it is docked into the shown layout on first sight.
- A layout overlay sends Esc to its terminal, so the dialog needs its own way out: the shortcut and the × button.
- `cx.bind_keys` adds to the app-wide keymap and can't take bindings back: bind each chord once per app run (keep a module-level set), and decide conflicts from keys.json at the moment of the press, not from what was bound earlier.
- Never bind `ctrl-alt-shift-escape`: it is Herdr's escape hatch. `rebind` refuses it.
- Any edit of keys.json makes the whole file the person's: Herdr stops merging new default shortcuts into it. Write it only when the person records a shortcut, and say so.
- A `window` overlay is dragged by any press the mod doesn't stop: stop `mouse_down` on the card's buttons.
- With a non-Latin keyboard layout `` ctrl-` `` may not reach Herdr as that chord; recording in settings uses whatever the layout produces.
- `--rm` removes the shell's record when it exits; a reboot or a herdr-core restart ends it.
- Find shells by name, not just the label: with the checkbox the label matches every folder's shell. hc names allow only 1-32 of `a-z 0-9 - _`, hence the hash.
- Decide the folder in the launcher's `init`: the launcher window doesn't take focus, so `focused()` is still the pane underneath.
- Never type `cd` into an existing shell: it would break a half-typed command or land in a running program.

## Done when

- `herdr-app check ~/.config/herdr-app/mods/quick-terminal` passes, `npm test` passes, and `herdr-app status` lists no errors.
- From a terminal pane, the shortcut opens the dialog with the cursor in the shell; pressing it again hides it and typing goes back to the same pane. A half-typed command survives hide and reopen. Esc reaches Vim or fzf inside it.
- Start `sleep 5; echo done`, hide, switch space, reopen: the same terminal address and the output are there. Several fast presses never start a second shell (`hc ls --label mod=quick-terminal`).
- `exit` or End shell closes everything; the next open starts a fresh shell.
- With the checkbox on, opening from tabs in two folders gives two shells (`hc ls --label mod=quick-terminal` shows both names and `folder=` labels), each opening in its folder; going back shows the first one's output. From a terminal on another machine the shared shell opens. End N others leaves only the shown shell.
- A new starting folder applies to the next shell only. With the starting folder deleted, the can't-start card appears and both recovery buttons work.
- Recording a free chord saves it to `global` and it toggles the terminal from terminal focus; a chord used by a terminal or layout binding is refused with its section named and nothing else in keys.json changes; pressing the current shortcut ends recording without writing.
- In a space on another machine the header shows `Local`. The header follows the theme and shortens the home folder.
