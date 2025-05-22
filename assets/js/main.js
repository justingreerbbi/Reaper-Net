// main.js (Modular version)
import { getSetting, updateSetting, watchSetting } from "./parts/settings.js";
import { makeDraggable } from "./parts/helpers.js";
import { startReaperNodeSocket, updateReaperNodeContent, reaperNodeSocket, openGroupChatModal, sendCommandToReaperNode } from "./parts/reaper-node.js";
import { showPopupNotification } from "./parts/notifications.js";
//import { listPlugins, getPlugin } from "./parts/pluginManager.js";
//import { encryptText, decryptText, generateSecretKey } from "./parts/crypto.js";
import { updateUserLocation, updateUserLocationOnMap, setFollowUserLocation, toggleFollowUserLocation, isFollowingUserLocation } from "./parts/map.js";

// A simple lightweight event bus for communication between components.
window.bus = new EventTarget();

window.map;
window.markers = [];
window.userLocation = null;
window.userLocationMarker = null;
window.updateGroupMessagesContent = updateGroupMessagesContent;

// Encryption Keys for the app. This is not secure by any means on the device itself. The idea is the encrypt the data being transmitted and assumes
// the device is secure. The keys are generated on the device and stored in localStorage.
// If the keys are changed, any messages sent with the old keys will not be able to be decrypted.
// @todo: Implement a SD card key storage system for the keys. This will allow for a way to load keys.
// @todo: Implement a way to update keys between devices using a and LoRa so keys can be updated between devices remotely.
window.secretKeys = {
	general: "b2cc3eaae2fccd28022cc94cba41b0e220e9fdbd5a50873b07d5d93ad382fdba5440a44d16f67d66",
};

let systemTimer;
let pluginsLoaded = false;

let status = {
	internetConnected: false,
	reaperNodeConnected: false,
	reaperNodeName: "",
	reaperNodePort: "",
	gpsDevice: "",
	gpsConnected: false,
	backendVersion: "0.0.0",
	frontendVersion: "0.0.0",
};

// @todo: We need to check if the app settings exist and if not, create them.
let appSettings = {
	startupMapCenter: [41.0128, -81.6054],
	startupMapZoom: 10,
	showNewGroupMessagePopup: true,
	showNewDirectMessagePopup: true,
};

function getServerStatusAndUpdate() {
	fetch("/api/status")
		.then((res) => res.json())
		.then((data) => {
			status = { ...status, ...data };

			const updateIcon = (selector, ok) => {
				document.querySelector(selector).innerHTML = `<i class="bi bi-${ok ? "check" : "x"}-square-fill text-${ok ? "success" : "danger"}"></i>`;
			};

			updateIcon("#internet-connection-status", status.internetConnected);
			updateIcon("#reaper-node-status", status.reaperNodeConnected);
			updateIcon("#gps-status", status.gpsConnected);

			// If there is a reaper node connected and the socket is not already started, start it.
			if (status.reaperNodeConnected && !reaperNodeSocket) {
				startReaperNodeSocket();
			}

			//console.log("Status Data:", data);
			document.getElementById("sys-backend-version-value").innerText = status.backendVersion;
			document.getElementById("sys-frontend-version-value").innerText = status.frontendVersion;
			const localStorageSize = Object.keys(localStorage).reduce((total, key) => {
				const value = localStorage.getItem(key);
				return total + key.length + (value ? value.length : 0);
			}, 0);
			document.getElementById("sys-storage-size-value").innerText = `${(localStorageSize / 1024).toFixed(2)} KB`;
		})
		.catch((error) => console.error("Error fetching status:", error));
}

function setupMap() {
	// Initialize the map and set the view to the startup location.
	window.map = L.map("map").setView(appSettings.startupMapCenter, appSettings.startupMapZoom);

	// Check if the there is a last known location in localStorage and set the map view to that location.
	const last_known_gps_data = JSON.parse(localStorage.getItem("last_gps_data"));
	if (last_known_gps_data) {
		updateUserLocation(last_known_gps_data);
		updateUserLocationOnMap();
	}

	// Set the base map layer.
	L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
		//L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
		minZoom: 6,
		maxZoom: 19,
		attribution: 'Map data © <a href="https://www.cartocdn.com/">cartocdn</a> contributors',
	}).addTo(map);

	// When the map is dragged, stop following the user location.
	window.map.on("dragstart", () => {
		if (isFollowingUserLocation) {
			setFollowUserLocation(false);
			showPopupNotification("Static Location", "You are no longer following your location.");
		}
	});

	// @todo: Add map ob click event.
}

function updateGroupMessagesContent() {
	const messages = JSON.parse(localStorage.getItem("reaper_group_messages") || "[]");
	const list = document.getElementById("group-messages-list");
	list.innerHTML = "";
	[...messages].reverse().forEach((msg) => {
		const date = new Date(msg.timestamp || Date.now());
		const formattedDate = date.toLocaleString();
		const html = `
				<div class="message-item">
					<div class="node-name"><strong>Node: ${msg.device_name}</strong></div>
					<div class="mt-1 message-content">${msg.message}</div>
					<div class="small text-secondary text-end mt-2">${formattedDate}</div>
				</div>
			`;
		list.insertAdjacentHTML("beforeend", html);
	});
}

document.addEventListener("DOMContentLoaded", () => {
	setupMap();
	document.querySelectorAll(".modal").forEach(makeDraggable);
	document.querySelectorAll(".modal").forEach((modal) => {
		modal.addEventListener("mousedown", () => {
			let maxZ = 1050;
			document.querySelectorAll(".modal").forEach((m) => {
				const z = parseInt(window.getComputedStyle(m).zIndex) || 1050;
				if (z > maxZ) maxZ = z;
			});
			modal.style.zIndex = maxZ + 1;
		});
	});

	// CENTER ON THE USER LOCATION AND FOLLOW IT
	document.getElementById("center-on-location-btn").addEventListener("click", () => {
		toggleFollowUserLocation();
	});

	// OPEN GLOBAL MESSAGES MODAL CHAT WINDOW.
	document.getElementById("open-global-messager-btn").addEventListener("click", () => {
		openGroupChatModal();
	});

	document.getElementById("send-reaper-cmd-btn").addEventListener("click", () => {
		const cmd = document.getElementById("reaper-cmd-input").value;
		if (cmd) {
			window.bus.dispatchEvent(new CustomEvent("bus:send_reaper_command", { detail: cmd }));
			document.getElementById("reaper-cmd-input").value = "";
		}
	});

	/**
	 * Encryption and Decryption Example
	 */
	//const message = "This is top secret.";
	//const secretKey = generateSecretKey();
	//console.log("Secret Key:", secretKey);

	/*encryptText(message, window.secretKeys.general)
		.then((encrypted) => {
			console.log("Encrypted:", encrypted);
			return decryptText(encrypted, window.secretKeys.general);
		})
		.then((decrypted) => {
			console.log("Decrypted:", decrypted);
		})
		.catch((err) => {
			console.error("Error:", err);
		});
		*/

	/**
	 * UPDATE MEMORY USAGE
	 * This function updates the memory usage information in the UI.
	 * It uses the performance.memory API to get the used JS heap size and the JS heap size limit.
	 * If the performance.memory API is not supported, it logs a warning to the console.
	 */
	function updateMemoryUsage() {
		if (performance.memory) {
			const usedJSHeap = performance.memory.usedJSHeapSize / 1048576; // MB
			const jsHeapLimit = performance.memory.jsHeapSizeLimit / 1048576;
			document.getElementById("sys-memory-used-value").innerText = `${usedJSHeap.toFixed(2)} MB`;
			document.getElementById("sys-memory-limit-value").innerText = `${jsHeapLimit.toFixed(2)} MB`;
		} else {
			console.warn("performance.memory is not supported in this browser. Memory stats will not be available.");
		}
	}

	/**
	 * FETCH STATUS AND UPDATE SYSTEM
	 */
	function fetchUpdates() {
		getServerStatusAndUpdate();
		updateMemoryUsage();
		updateReaperNodeContent();
		updateGroupMessagesContent();
	}

	/**
	 * @todo: Plugins need to be loaded from the server before they can be accessed.
	 *
	 * This almost needs to be blocking until the plugins are loaded and then let the rest of the page load.
	 * I am not sure how I am going to do this yet. I will swing back around to it.
	 */
	function loadPlugins() {
		// @todo: Fetch the list of plugins from localStorage or a server endpoint
		//const enabledPlugins = ["ExamplePlugin"]; // Example of enabled plugins
		const enabledPlugins = ["ReaperMessaging"]; // Blank for now until I get time to incorporate the plugin manager fully.
		fetch("/api/plugins")
			.then((res) => res.json())
			.then((pluginList) => {
				pluginList.forEach((plugin) => {
					if (!enabledPlugins.includes(plugin)) return; // Skip if not enabled
					const script = document.createElement("script");
					script.src = `/plugins/${plugin}.js`; // load plugin from public folder
					script.type = "module";
					script.onerror = () => console.error(`Failed to load plugin: ${plugin}`);
					document.body.appendChild(script);
				});
				pluginsLoaded = true;
			});
	}
	loadPlugins();

	/**
	 * START POLLING / TIMER
	 */
	function startPolling() {
		if (systemTimer) clearInterval(systemTimer);
		const seconds = getSetting("status_update_interval");
		systemTimer = setInterval(fetchUpdates, seconds * 1000);
		//console.log("⏱ Polling every", seconds, "seconds.");
	}

	// Set a watcher on the status_update_interval setting
	watchSetting("status_update_interval", (newVal) => {
		//console.log("🔄 status_update_interval changed:", newVal);
		startPolling();
	});

	startPolling();
	fetchUpdates();
});

/**
 * SYSTEM EVENT LISTENERS
 * These are the event listeners for the system events.
 *
 * DO NOT CHANGE OR MODIFY UNLESS YOU KNOW WHAT YOU ARE DOING.
 */

// Reaper GPS Update
window.bus.addEventListener("bus:gps_update", (gpsData) => {
	//console.log("GPS Update:", gpsData.detail);
	updateUserLocation(gpsData.detail);
	updateUserLocationOnMap();
});

// Reaper Log from a Reaper Node
window.bus.addEventListener("bus:log_update", (logData) => {
	//console.log("Reaper Log:", logData.detail);
});

// Listen for Reaper Node Group Message
window.bus.addEventListener("bus:reaper_node_received_group_message", (message) => {
	//console.log("Reaper Node Group Message:", message.detail);
	if (appSettings.showNewGroupMessagePopup) {
		showPopupNotification("New Group Message", message.detail.device_name + "<br/>" + message.detail.message);
	}
});

// Listen for Reaper Node Direct Message
window.bus.addEventListener("bus:reaper_node_received_direct_message", (message) => {
	//console.log("Reaper Node Direct Message:", message.detail);
	if (appSettings.showNewDirectMessagePopup) {
		showPopupNotification("New Direct Message", message.detail.device_name + "<br/>" + message.detail.message);
	}
});

// Listen for Reaper Node Beacon Message
window.bus.addEventListener("bus:reaper_node_received_beacon_message", (message) => {
	console.log("Reaper Node Beacon Message:", message.detail);
});

// Listen for Reaper Node Command Send
window.bus.addEventListener("bus:send_reaper_command", (cmd) => {
	//console.log("Reaper Node Command:", cmd.detail);
	if (reaperNodeSocket) {
		sendCommandToReaperNode(cmd.detail);
	} else {
		console.error("Reaper Node Socket is not connected.");
	}
});
// @todo: Repear Incoming Group Message
// @todo: Reaper Incoming Direct Message
