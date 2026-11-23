# Phantom Panel

A GNOME Shell extension that hides the top bar without leaving reserved empty space behind, with configurable intellihide, pressure-barrier hover reveal, and keyboard toggle support.

## Features

- **Zero Reserved Space**: Removes top-bar struts while active so maximized and tiled windows use the full monitor height (`y = 0`), restoring struts cleanly on disable (without shifting windows on lock screen).
- **Intellihide & Strict Mode**: Automatically hides the panel when windows on the primary monitor are maximized or overlap the top bar area, with an optional strict mode that only hides on physical overlap.
- **Pressure-Barrier Hover Reveal**: Reveals the panel when pushing the pointer against the top edge of the primary monitor (configurable pressure threshold, or `0` for instant hover), while respecting fullscreen apps and open top-bar menus.
- **Overview & Empty Workspace Rules**: Independently control whether the panel shows in the Activities Overview or when the active workspace has no windows.
- **Custom Timing & Shortcut**: Configure slide animation duration, pointer leave delay, pressure threshold, and a keyboard shortcut to toggle panel visibility.
- **Wayland Direct-Scanout Safe**: Disables compositor unredirection while the panel is visible so it renders reliably over maximized/fullscreen apps.

## Requirements

- GNOME Shell **50–51**
- `glib-compile-schemas` (from `glib2`)
- `curl` and `tar` (for the one-line installer)

## Installation

### Quick Install (`curl`)

```bash
TMP=$(mktemp -d) && \
curl -fsSL https://github.com/DenHafiz69/phantom-panel/archive/refs/heads/main.tar.gz | tar -xz -C "$TMP" && \
(cd "$TMP/phantom-panel-main" && bash install.sh) && \
rm -rf "$TMP"
```

### From Source (`git`)

```bash
git clone https://github.com/DenHafiz69/phantom-panel.git
cd phantom-panel
./install.sh
```

### Activate

Restart GNOME Shell after installing:
- **Wayland**: Log out and log back in.
- **X11**: Press `Alt+F2`, type `r`, and press `Enter`.

Then enable the extension:

```bash
gnome-extensions enable phantompanel@denhafiz.my
```

## Configuration

Open the extension settings via the **Extensions** app or run:

```bash
gnome-extensions prefs phantompanel@denhafiz.my
```

Available options:
- **Show panel on hover**: Reveal the panel from the top edge.
- **Show panel in overview**: Always show the panel in Activities Overview.
- **Intellihide**: Hide only when a window occupies or overlaps the top area.
- **Only hide when window covers top bar**: Stricter overlap check for intellihide.
- **Show top bar in empty workspace**: Keep the panel visible when no windows are open on the primary monitor.
- **Animation duration (ms)**: Panel slide transition speed.
- **Hide delay (ms)**: Delay before hiding after the pointer leaves the panel.
- **Top edge pressure threshold (px)**: Pointer pressure needed to reveal the panel (`0` = instant hover).
- **Toggle panel shortcut**: Keybinding to manually toggle panel visibility (e.g. `<Super><Alt>p`).

## Uninstall

```bash
gnome-extensions disable phantompanel@denhafiz.my
rm -rf ~/.local/share/gnome-shell/extensions/phantompanel@denhafiz.my
```

## License

MIT — see [LICENSE](LICENSE).
