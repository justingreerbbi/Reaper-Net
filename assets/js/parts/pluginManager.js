const plugins = new Map();

export function registerPlugin({ name, init, exports = {} }) {
	if (!name || typeof init !== "function") {
		console.warn("Invalid plugin object.");
		return;
	}
	console.log(`🔌 Plugin registered: ${name}`);
	const plugin = { name, init, exports };
	plugins.set(name, plugin);
	init();
}

export function getPlugin(name) {
	return plugins.get(name)?.exports || null;
}

export function listPlugins() {
	return Array.from(plugins.keys());
}
