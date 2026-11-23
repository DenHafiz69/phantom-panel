#!/bin/bash

UUID="phantompanel@denhafiz.my"
DEST_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo "Installing Phantom Panel extension..."

# 1. Compile schemas
echo "Compiling schemas..."
glib-compile-schemas schemas/

# 2. Create destination directory
echo "Creating directory: $DEST_DIR"
mkdir -p "$DEST_DIR"

# 3. Copy files (unlink destination first so mmap'd gschemas.compiled isn't overwritten in-place)
echo "Copying files..."
cp -r --remove-destination extension.js prefs.js metadata.json schemas "$DEST_DIR/"

echo "Installation complete!"
echo "----------------------------------------------------"
echo "To activate the extension:"
echo "1. Restart GNOME Shell (Alt+F2, type 'r', Enter on X11, or log out on Wayland)"
echo "2. Run: gnome-extensions enable $UUID"
echo "3. Or use the 'Extensions' app to enable it."
echo "----------------------------------------------------"
