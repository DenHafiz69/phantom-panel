import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class PhantomPanelPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window._settings = settings;

        const page = new Adw.PreferencesPage({
            title: _('Settings'),
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);

        const behaviorGroup = new Adw.PreferencesGroup({
            title: _('Behavior'),
            description: _('Configure when the panel should be shown'),
        });
        page.add(behaviorGroup);

        const hoverRow = new Adw.SwitchRow({
            title: _('Show panel on hover'),
            subtitle: _('Show the panel when the mouse cursor approaches the top edge of the screen'),
        });
        behaviorGroup.add(hoverRow);

        const overviewRow = new Adw.SwitchRow({
            title: _('Show panel in overview'),
            subtitle: _('Show the panel when the Activities Overview is open'),
        });
        behaviorGroup.add(overviewRow);

        const intellihideRow = new Adw.SwitchRow({
            title: _('Intellihide'),
            subtitle: _('Only hide the panel when a window takes up the space at the top of the screen'),
        });
        behaviorGroup.add(intellihideRow);

        const emptyWorkspaceRow = new Adw.SwitchRow({
            title: _('Show top bar in empty workspace'),
            subtitle: _('Always show the panel when there are no windows on the current workspace'),
        });
        behaviorGroup.add(emptyWorkspaceRow);

        const intellihideStrictRow = new Adw.SwitchRow({
            title: _('Only hide when window covers top bar'),
            subtitle: _('Hide the panel only when a window physically overlaps the top bar area'),
        });
        behaviorGroup.add(intellihideStrictRow);

        settings.bind('show-on-hover', hoverRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        settings.bind('show-in-overview', overviewRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        settings.bind('intellihide', intellihideRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        settings.bind('show-in-empty-workspace', emptyWorkspaceRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        settings.bind('intellihide-strict', intellihideStrictRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        settings.bind('intellihide', intellihideStrictRow, 'sensitive', Gio.SettingsBindFlags.GET);

        const timingGroup = new Adw.PreferencesGroup({
            title: _('Timing & Trigger'),
            description: _('Adjust animation speed, hover sensitivity, and shortcut'),
        });
        page.add(timingGroup);

        const animationRow = new Adw.SpinRow({
            title: _('Animation duration (ms)'),
            subtitle: _('Speed of the panel slide transition'),
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 1000,
                step_increment: 25,
                page_increment: 100,
            }),
        });
        timingGroup.add(animationRow);
        settings.bind('animation-duration', animationRow, 'value', Gio.SettingsBindFlags.DEFAULT);

        const hoverDelayRow = new Adw.SpinRow({
            title: _('Hide delay (ms)'),
            subtitle: _('Time to wait before hiding after the pointer leaves the panel'),
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 2000,
                step_increment: 25,
                page_increment: 100,
            }),
        });
        timingGroup.add(hoverDelayRow);
        settings.bind('hover-delay', hoverDelayRow, 'value', Gio.SettingsBindFlags.DEFAULT);

        const pressureRow = new Adw.SpinRow({
            title: _('Top edge pressure threshold (px)'),
            subtitle: _('Pressure needed to reveal the panel (0 = instant hover)'),
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 500,
                step_increment: 10,
                page_increment: 50,
            }),
        });
        timingGroup.add(pressureRow);
        settings.bind('pressure-threshold', pressureRow, 'value', Gio.SettingsBindFlags.DEFAULT);

        const shortcutRow = new Adw.EntryRow({
            title: _('Toggle panel shortcut (e.g. <Super><Alt>p)'),
            show_apply_button: true,
        });
        const currentShortcut = settings.get_strv('toggle-panel-shortcut')[0] || '';
        shortcutRow.set_text(currentShortcut);
        shortcutRow.connect('apply', () => {
            const text = shortcutRow.get_text().trim();
            settings.set_strv('toggle-panel-shortcut', text ? [text] : []);
        });
        const shortcutChangedId = settings.connect('changed::toggle-panel-shortcut', () => {
            const updated = settings.get_strv('toggle-panel-shortcut')[0] || '';
            if (shortcutRow.get_text() !== updated) {
                shortcutRow.set_text(updated);
            }
        });
        window.connect('close-request', () => {
            settings.disconnect(shortcutChangedId);
        });
        timingGroup.add(shortcutRow);
    }
}
