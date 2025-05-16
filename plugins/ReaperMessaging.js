import { registerPlugin } from "/assets/js/parts/pluginManager.js";

registerPlugin({
	name: "ReaperMessaging",
	exports: {
		send(message) {
			console.log("📤 ReaperMessaging sending:", message);
			// you can integrate socket sending here
		},
		quick(type) {
			console.log("⚡ Quick message:", type);
		},
	},
	init() {
		console.log("✅ ReaperMessaging initialized");
		// Create your UI here, like before
	},
});
