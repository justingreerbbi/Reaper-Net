const SETTINGS_KEY = "reaper_net_settings";

const defaultSettings = {
	status_update_interval: 10000, // Second
	browser_notification: false,
	language: "en",
};

const watchers = {};

function loadSettings() {
	const stored = localStorage.getItem(SETTINGS_KEY);
	if (stored) {
		try {
			return JSON.parse(stored);
		} catch {
			localStorage.setItem(SETTINGS_KEY, JSON.stringify(defaultSettings));
			return { ...defaultSettings };
		}
	} else {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify(defaultSettings));
		return { ...defaultSettings };
	}
}

function saveSettings(settings) {
	localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

let settings = loadSettings();

export function getSetting(key) {
	return settings[key];
}

export function updateSetting(key, value) {
	if (settings[key] === value) return; // No change

	settings[key] = value;
	saveSettings(settings);

	// Notify watchers
	if (watchers[key]) {
		watchers[key].forEach((callback) => callback(value));
	}
}

export function watchSetting(key, callback) {
	if (!watchers[key]) {
		watchers[key] = [];
	}
	watchers[key].push(callback);
}
