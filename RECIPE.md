# Quick Terminal

Install one centered, keyboard-operated terminal shared by the user's local Herdr workspaces. Read the running version's app-home AGENTS.md first. The code lives in `mods/quick-terminal/`.

## Install or update

1. Resolve the app home from HERDR_APP_HOME or ~/.config/herdr-app. Back up an existing quick-terminal installation before updating. Write mod.json (place none) before copying the JS and SVG files so Herdr doesn't dock a new panel. Leave generated types to Herdr.
2. Preserve the user's keys.json. Keep an existing binding to mod.open:quick-terminal. On first install use Ctrl + backtick if available in all sections, including the start of a multi-key binding. If occupied, open the mod with `herdr-app do mod.open --name quick-terminal` and let the user record an available chord. A string global action is enough. The mod requires no layout block, agent hooks or workspace files.
3. Run herdr-app check on the installed folder, then herdr-app status. Check for key and runtime errors. The mod loads live.

## Runtime

Herdr's mod.open command toggles the launcher even when no copy of the mod is visible. The launcher creates a native dialog layout containing a header and a terminal block. The dialog gives the first terminal focus. Hiding the launcher closes the dialog; closing the dialog or exiting its terminal also dismisses the launcher. Herdr restores focus to the underlying workspace.

The session module checks local live terminals with the mod label. It starts the configured shell with hc run, a unique name, no parent and automatic removal after exit. Concurrent launches recheck ownership if the name is already taken. Settings use the native folder picker and an optimistic write of keys.json. Existing key actions are intercepted in the recorder's focus context to prevent a bound chord performing an unrelated action.

## Done when

- Invoke the shortcut twice from a terminal pane. The first press places the cursor inside the overlay; the second returns keyboard input to the same pane. Type a partial command, hide and reopen to check it survives. Escape reaches Vim or a terminal picker.
- Start a delayed command, hide, switch workspace, and reopen. Compare the terminal address and output. Rapid presses produce at most one local shell. Exit starts a fresh session on the next invocation.
- Pick another folder and restart the shell. Remove a disposable configured folder to exercise the recovery buttons. The current shell's cwd is retained when settings change.
- Record a free shortcut, verify it opens and hides from terminal focus, then try a chord already used in a terminal or layout. Verify unrelated actions and settings survive. Reopen the app while core stays up and verify the same session is reachable.
- Inspect the overlay on a small and a large window. The header uses the current theme and shortens the home path. Remote workspaces identify the shell as local.
