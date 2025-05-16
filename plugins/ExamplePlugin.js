import { registerPlugin } from "/assets/js/parts/pluginManager.js";
import { createInfoModal } from "/assets/js/parts/notifications.js";

registerPlugin({
	name: "ExamplePlugin",
	init() {
		console.log("Example Plugin initialized");

		//alert("Example Plugin loaded! This is a simple plugin that shows an alert when initialized.");

		// Example of using the createInfoModal function
		const title = "Example Plugin";
		const body = "A plugin and tap into the core functionality of the app. This is a simple example of a plugin that shows an alert when initialized using the createInfoModal function.";
		createInfoModal(title, body);

		// Example of adding a button to the toolbar and shows a notification when clicked
		const button = document.createElement("button");
		button.innerText = "Click me!";
		button.style.background = "#007bff";
		button.style.color = "#fff";
		button.style.border = "none";
		button.style.padding = "10px 20px";
		button.style.borderRadius = "5px";

		button.addEventListener("click", () => {
			createInfoModal("Button Clicked", "You clicked the button from the Example Plugin!");
		});
		const toolbar = document.getElementById("toolbar");
		if (toolbar) {
			toolbar.appendChild(button);
		} else {
			console.error("Toolbar not found");
		}
	},
});
