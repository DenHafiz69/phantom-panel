import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import * as Layout from 'resource:///org/gnome/shell/ui/layout.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const PRESSURE_TIMEOUT = 1000;

export default class PhantomPanelExtension extends Extension {
    get _panelHeight() {
        return (this._panel && this._panel.height > 0) ? this._panel.height : (this._cachedPanelHeight || 32);
    }

    _setPanelStruts(affectsStruts) {
        if (!this._panel) return;

        const actorData = Main.layoutManager._trackedActors?.find(d => d.actor === this._panel);
        if (actorData) {
            actorData.affectsStruts = affectsStruts;
        } else {
            try {
                Main.layoutManager.untrackChrome(this._panel);
                Main.layoutManager.trackChrome(this._panel, {
                    affectsStruts,
                    trackFullscreen: true,
                });
            } catch (e) {
                console.error(`[PhantomPanel] Error configuring panel struts: ${e}`);
            }
        }
        Main.layoutManager._queueUpdateRegions();
    }

    _setUnredirectDisabled(disabled) {
        if (disabled === this._unredirectDisabled) return;

        if (disabled) {
            global.compositor.disable_unredirect();
        } else {
            global.compositor.enable_unredirect();
        }
        this._unredirectDisabled = disabled;
    }

    _setupHoverTrigger() {
        this._destroyHoverTrigger();

        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor) return;

        const threshold = this._settings.get_int('pressure-threshold');

        if (threshold > 0) {
            try {
                this._pressureBarrier = new Layout.PressureBarrier(
                    threshold,
                    PRESSURE_TIMEOUT,
                    Shell.ActionMode.NORMAL
                );
                this._pressureBarrier.connect('trigger', () => {
                    if (!this._settings || !this._settings.get_boolean('show-on-hover')) return;
                    if (Main.layoutManager.primaryMonitor?.inFullscreen) return;

                    this._cancelLeaveTimeout();
                    this._hovering = true;
                    this._updatePanelVisibility();
                });

                this._barrier = new Meta.Barrier({
                    backend: global.backend,
                    x1: monitor.x,
                    y1: monitor.y,
                    x2: monitor.x + monitor.width,
                    y2: monitor.y,
                    directions: Meta.BarrierDirection.POSITIVE_Y,
                });
                this._pressureBarrier.addBarrier(this._barrier);
                return;
            } catch (e) {
                console.warn(`[PhantomPanel] PressureBarrier unavailable, falling back to hover widget: ${e}`);
                this._destroyHoverTrigger();
            }
        }

        // Instant hover fallback (threshold === 0 or barrier unsupported)
        this._hoverActor = new St.Widget({
            name: 'phantom-panel-hover-actor',
            reactive: true,
            height: 1,
            width: monitor.width,
            x: monitor.x,
            y: monitor.y,
            style: 'background-color: rgba(0,0,0,0);',
        });
        Main.layoutManager.addChrome(this._hoverActor, {trackFullscreen: true});

        this._hoverActorEnterId = this._hoverActor.connect('enter-event', () => {
            this._cancelLeaveTimeout();
            if (this._settings.get_boolean('show-on-hover')) {
                this._hovering = true;
                this._updatePanelVisibility();
            }
        });
    }

    _destroyHoverTrigger() {
        if (this._pressureBarrier) {
            if (this._barrier) {
                this._pressureBarrier.removeBarrier(this._barrier);
                this._barrier.destroy();
                this._barrier = null;
            }
            this._pressureBarrier.destroy();
            this._pressureBarrier = null;
        }

        if (this._hoverActor) {
            if (this._hoverActorEnterId) {
                this._hoverActor.disconnect(this._hoverActorEnterId);
                this._hoverActorEnterId = null;
            }
            Main.layoutManager.removeChrome(this._hoverActor);
            this._hoverActor.destroy();
            this._hoverActor = null;
        }
    }

    _cancelLeaveTimeout() {
        if (this._leaveTimeoutId) {
            GLib.source_remove(this._leaveTimeoutId);
            this._leaveTimeoutId = 0;
        }
    }

    _disconnectActiveMenu() {
        if (this._activeMenu) {
            this._activeMenu.disconnectObject(this);
            this._activeMenu = null;
        }
    }

    enable() {
        this._settings = this.getSettings();
        this._panel = Main.layoutManager.panelBox;
        this._originalPanelReactive = this._panel.reactive;
        this._cachedPanelHeight = (this._panel && this._panel.height > 0) ? this._panel.height : 32;

        // Tracks state
        this._overviewVisible = false;
        this._hovering = false;
        this._toggled = false;
        this._windowOverlaps = false;
        this._workspaceEmpty = false;
        this._unredirectDisabled = false;
        this._leaveTimeoutId = 0;
        this._activeMenu = null;
        this._trackedWindows = new Map();

        // Ensure the panel does not reserve strut space while Phantom Panel is active,
        // so maximized windows use the full screen instead of leaving an empty space behind.
        this._setPanelStruts(false);

        // Keep track of panel allocation / size changes
        this._panelAllocationId = this._panel.connect('notify::allocation', () => {
            if (this._panel && this._panel.height > 0) {
                this._cachedPanelHeight = this._panel.height;
            }
            const monitor = Main.layoutManager.primaryMonitor;
            if (this._hoverActor && monitor) {
                this._hoverActor.set_position(monitor.x, monitor.y);
                this._hoverActor.width = monitor.width;
            }
        });

        this._setupHoverTrigger();

        this._panel.reactive = true;
        this._panelEnterId = this._panel.connect('enter-event', () => {
            this._cancelLeaveTimeout();
            if (this._settings.get_boolean('show-on-hover')) {
                this._hovering = true;
            }
        });

        this._panelLeaveId = this._panel.connect('leave-event', () => {
            this._cancelLeaveTimeout();
            const delay = this._settings.get_int('hover-delay');

            this._leaveTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
                this._leaveTimeoutId = 0;
                if (!this._panel) return GLib.SOURCE_REMOVE;

                const monitor = Main.layoutManager.primaryMonitor;
                if (monitor) {
                    const [x, y] = global.get_pointer();
                    const panelH = this._panelHeight;
                    const inX = x >= monitor.x && x <= monitor.x + monitor.width;
                    const inY = y >= monitor.y && y <= monitor.y + panelH;
                    if (inX && inY) {
                        return GLib.SOURCE_REMOVE;
                    }
                }

                // If a top bar popup menu is currently active, wait until it closes
                if (Main.panel.menuManager?.activeMenu) {
                    this._disconnectActiveMenu();
                    this._activeMenu = Main.panel.menuManager.activeMenu;
                    this._activeMenu.connectObject('open-state-changed', (menu, open) => {
                        if (!open) {
                            this._disconnectActiveMenu();
                            this._hovering = false;
                            this._updatePanelVisibility();
                        }
                    }, this);
                    return GLib.SOURCE_REMOVE;
                }

                this._hovering = false;
                this._updatePanelVisibility();
                return GLib.SOURCE_REMOVE;
            });
        });

        // Keybinding to toggle panel visibility
        Main.wm.addKeybinding(
            'toggle-panel-shortcut',
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            () => {
                this._toggled = !this._toggled;
                this._updatePanelVisibility();
            }
        );

        // Overview signals
        this._onOverviewShowingId = Main.overview.connect('showing', () => {
            this._overviewVisible = true;
            this._updatePanelVisibility();
        });
        this._onOverviewHidingId = Main.overview.connect('hiding', () => {
            this._overviewVisible = false;
            this._updatePanelVisibility();
        });

        // Window tracking for intellihide
        this._onWindowCreatedId = global.display.connect('window-created', (d, win) => this._addWindowSignals(win));
        this._onActiveWorkspaceChangedId = global.workspace_manager.connect('active-workspace-changed', () => this._checkIntellihide());
        this._onFocusWindowId = global.display.connect('notify::focus-window', () => this._checkIntellihide());
        this._onRestackedId = global.display.connect('restacked', () => this._checkIntellihide());

        // Track existing windows
        for (const actor of global.get_window_actors()) {
            const win = actor.meta_window;
            if (win) this._addWindowSignals(win);
        }

        // Monitor changes
        this._onMonitorsChangedId = Main.layoutManager.connect('monitors-changed', () => {
            this._setupHoverTrigger();
            this._checkIntellihide();
        });

        // Initial check and state application (without animation)
        this._checkIntellihide();
        this._updatePanelVisibility(false);

        // Watch settings changes
        this._settingsChangedId = this._settings.connect('changed', (settings, key) => {
            if (key === 'pressure-threshold') {
                this._setupHoverTrigger();
            }
            this._checkIntellihide();
            this._updatePanelVisibility();
        });
    }

    _addWindowSignals(window) {
        if (!window || this._trackedWindows.has(window)) return;

        const signalIds = [
            window.connect('size-changed', () => this._checkIntellihide()),
            window.connect('position-changed', () => this._checkIntellihide()),
            window.connect('notify::minimized', () => this._checkIntellihide()),
            window.connect('notify::maximized-horizontally', () => this._checkIntellihide()),
            window.connect('notify::maximized-vertically', () => this._checkIntellihide()),
            window.connect('workspace-changed', () => this._checkIntellihide()),
            window.connect('unmanaged', (w) => {
                this._removeWindowSignals(w);
                this._checkIntellihide();
            }),
        ];
        this._trackedWindows.set(window, signalIds);
        this._checkIntellihide();
    }

    _removeWindowSignals(window) {
        const signalIds = this._trackedWindows.get(window);
        if (signalIds) {
            signalIds.forEach(id => window.disconnect(id));
            this._trackedWindows.delete(window);
        }
    }

    disable() {
        this._cancelLeaveTimeout();
        this._disconnectActiveMenu();
        this._setUnredirectDisabled(false);

        Main.wm.removeKeybinding('toggle-panel-shortcut');

        // Restore panel struts except when locking the screen (unlock-dialog),
        // which would shrink the work area and push floating windows down.
        this._setPanelStruts(Main.sessionMode.currentMode !== 'unlock-dialog');

        // Restore panel position and reactivity
        if (this._panel) {
            this._panel.remove_all_transitions();
            this._panel.translation_y = 0;
            this._panel.reactive = this._originalPanelReactive;

            if (this._panelLeaveId) {
                this._panel.disconnect(this._panelLeaveId);
                this._panelLeaveId = null;
            }
            if (this._panelEnterId) {
                this._panel.disconnect(this._panelEnterId);
                this._panelEnterId = null;
            }
            if (this._panelAllocationId) {
                this._panel.disconnect(this._panelAllocationId);
                this._panelAllocationId = null;
            }
        }

        this._destroyHoverTrigger();

        if (this._onOverviewShowingId) Main.overview.disconnect(this._onOverviewShowingId);
        if (this._onOverviewHidingId) Main.overview.disconnect(this._onOverviewHidingId);
        if (this._onWindowCreatedId) global.display.disconnect(this._onWindowCreatedId);
        if (this._onActiveWorkspaceChangedId) global.workspace_manager.disconnect(this._onActiveWorkspaceChangedId);
        if (this._onFocusWindowId) global.display.disconnect(this._onFocusWindowId);
        if (this._onRestackedId) global.display.disconnect(this._onRestackedId);
        if (this._onMonitorsChangedId) Main.layoutManager.disconnect(this._onMonitorsChangedId);
        if (this._settingsChangedId) this._settings.disconnect(this._settingsChangedId);

        // Disconnect window signals
        if (this._trackedWindows) {
            for (const [win, signalIds] of this._trackedWindows) {
                signalIds.forEach(id => win.disconnect(id));
            }
            this._trackedWindows.clear();
            this._trackedWindows = null;
        }

        this._settings = null;
        this._panel = null;
    }

    _checkIntellihide() {
        if (!this._settings || !this._panel) return;

        const workspace = global.workspace_manager.get_active_workspace();
        const monitor = Main.layoutManager.primaryMonitor;
        if (!workspace || !monitor) return;

        const primaryIndex = Main.layoutManager.primaryIndex;
        const windows = workspace.list_windows().filter(w =>
            w.get_monitor() === primaryIndex &&
            w.showing_on_its_workspace() &&
            !w.is_above() &&
            !w.minimized &&
            w.window_type === Meta.WindowType.NORMAL &&
            !w.is_skip_taskbar()
        );

        // Show-in-empty-workspace: track whether there are any visible windows on primary monitor
        const wasEmpty = this._workspaceEmpty;
        this._workspaceEmpty = windows.length === 0;

        const intellihideEnabled = this._settings.get_boolean('intellihide');
        const strictEnabled = this._settings.get_boolean('intellihide-strict');

        if (!intellihideEnabled && !strictEnabled) {
            this._windowOverlaps = false;
            if (this._workspaceEmpty !== wasEmpty) this._updatePanelVisibility();
            return;
        }

        let overlaps = false;
        const panelBottom = monitor.y + this._panelHeight;

        for (const window of windows) {
            const frame = window.get_frame_rect();
            if (strictEnabled) {
                // Only hide when the window physically overlaps the top bar area
                if (frame.y < panelBottom) {
                    overlaps = true;
                    break;
                }
            } else {
                // Default: hide when window is maximized, vertically maximized, or overlaps top bar
                const isVerticallyMaximized = typeof window.maximized_vertically === 'function'
                    ? window.maximized_vertically()
                    : false;

                if (window.is_maximized() || isVerticallyMaximized || frame.y <= panelBottom) {
                    overlaps = true;
                    break;
                }
            }
        }

        if (this._windowOverlaps !== overlaps || this._workspaceEmpty !== wasEmpty) {
            this._windowOverlaps = overlaps;
            this._updatePanelVisibility();
        }
    }

    _updatePanelVisibility(animate = true) {
        if (!this._panel || !this._settings) return;

        let shouldShow = false;

        if (this._overviewVisible && this._settings.get_boolean('show-in-overview')) {
            shouldShow = true;
        } else if (this._toggled) {
            shouldShow = true;
        } else if (this._hovering) {
            shouldShow = true;
        } else if (Main.panel.menuManager?.activeMenu) {
            shouldShow = true;
        } else if (this._settings.get_boolean('show-in-empty-workspace') && this._workspaceEmpty) {
            shouldShow = true;
        } else if (this._settings.get_boolean('intellihide') || this._settings.get_boolean('intellihide-strict')) {
            shouldShow = !this._windowOverlaps;
        } else {
            shouldShow = false;
        }

        const targetY = shouldShow ? 0 : -this._panelHeight;
        const duration = animate ? this._settings.get_int('animation-duration') : 0;

        // Disable unredirection while the panel is visible so it paints above
        // fullscreen/maximized direct-scanout windows on Wayland/X11.
        if (shouldShow) {
            this._setUnredirectDisabled(true);
        }

        this._panel.remove_all_transitions();

        if (duration > 0) {
            this._panel.ease({
                translation_y: targetY,
                duration,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    if (this._panel) {
                        this._panel.translation_y = targetY;
                        if (!shouldShow) {
                            this._setUnredirectDisabled(false);
                        }
                    }
                },
            });
        } else {
            this._panel.translation_y = targetY;
            if (!shouldShow) {
                this._setUnredirectDisabled(false);
            }
        }
    }
}
