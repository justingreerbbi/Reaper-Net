// main.js (Modular version)
import { getSetting, updateSetting, watchSetting } from "./parts/settings.js";
import { makeDraggable } from "./parts/helpers.js";
import { startReaperNodeSocket, updateReaperNodeContent, reaperNodeSocket, openGlobalChatWindow, sendCommandToReaperNode } from "./parts/reaper-node.js";
import { showPopupNotification } from "./parts/notifications.js";
import { updateUserLocation, updateUserLocationOnMap, setFollowUserLocation, toggleFollowUserLocation, isFollowingUserLocation } from "./parts/map.js";

// A simple lightweight event bus for communication between components.
window.bus = new EventTarget();

window.map;
window.markers = [];
window.userLocation = null;
window.userLocationMarker = null;
window.nodeMarkers = [];

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
	startupMapZoom: 15,
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

/**
 * Setup the Map
 * 
 * This function initializes the map and sets the view to the startup location.
 * Right now it also as map listeners as well. I am not sure if we want to keep this here or move it to a different file.
 * We will have to look into this later.
 */
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

/**
 * Update all the node markers on the map.
 * 
 * This function will check if the node already exists on the map and update its location.
 * If the node does not exist, it will create a new marker for the node.
 * If it does exist, it will update the marker's location.
 */
function updateNodeMarkers() {
	const nodes = JSON.parse(localStorage.getItem("reaper_nodes_found") || "[]");
	const nodeMarkersMap = new Map(window.nodeMarkers.map((m) => [m.device_name, m]));

	//console.log("Updating Node Markers:", nodes);

	nodes.forEach((node) => {
		const device_name = node.device_name || `Unknown Node`;
		const latitude = node.telemetry.latitude || 0.0;
		const longitude = node.telemetry.longitude || 0.0;
		const speed = node.telemetry.speed || 0;
		const altitude = node.telemetry.altitude || 0;
		const heading = node.telemetry.heading || 0;
		const satellites = node.telemetry.satellites || 0;

		let markerObj = nodeMarkersMap.get(device_name);

		if (markerObj) {
			// Animate marker to new location
			if (markerObj.marker.getLatLng().lat !== latitude || markerObj.marker.getLatLng().lng !== longitude) {
				markerObj.marker.setLatLng([latitude, longitude]);
				// Optionally, you can add a bounce or highlight animation here
				if (markerObj.marker._icon) {
					markerObj.marker._icon.classList.add("marker-animate");
					setTimeout(() => markerObj.marker._icon.classList.remove("marker-animate"), 600);
				}
			}
		} else {
			// Create new marker
			const blueTriangleIcon = L.divIcon({
				className: "custom-blue-triangle-icon",
				iconSize: [32, 32],
				iconAnchor: [16, 16],
				popupAnchor: [0, -16],
				html: `
					<div style="
						width:32px;
						height:32px;
						display: flex;
						align-items: center;
						justify-content: center;
					">
						<svg width="20" height="20" viewBox="0 0 20 20">
							<polygon points="10,2 18,18 2,18" fill="#3a5f2d" stroke="#CCCCCC" stroke-width="2"/>
						</svg>
					</div>
				`,
			});
			const marker = L.marker([latitude, longitude], { title: device_name, icon: blueTriangleIcon }).addTo(window.map);
			marker.bindPopup(
				`<div class="marker-popup">
					<h4>${device_name}</h4>
					<div>${latitude}, ${longitude}</div>
					<div>Speed: ${speed} km/h</div>
					<div>Altitude: ${altitude} m</div>
					<div>Heading: ${heading}°</div>		
					<div>Satellites: ${satellites}</div>
				</div>`,
				{ closeButton: false, minWidth: 200 }
			);
			window.nodeMarkers.push({ device_name, marker });
		}
	});
}

/**
 * Document ready event listener
 * This function is called when the DOM is fully loaded.
 */
document.addEventListener("DOMContentLoaded", () => {
	// Load the map and set the view to the startup location.
	setupMap();

	// This is a little bit of a hack and will be removed later.
	// All modals will be handled by their respect module eventually and they will also handle tif somethign is draggable.
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
		openGlobalChatWindow();
	});

	// SEND REAPER COMMAND BTN LISTENER.
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
		updateNodeMarkers();
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
	//loadPlugins(); // Uncomment this line to start loading plugins.

	/**
	 * START POLLING / TIMER
	 * This is just testing a watcher, we may be able to remove this due to the way we handle events now. This is just a test for now.
	 */
	function startPolling() {
		if (systemTimer) clearInterval(systemTimer);
		const seconds = getSetting("status_update_interval");
		systemTimer = setInterval(fetchUpdates, seconds * 1000);
		//console.log("⏱ Polling every", seconds, "seconds.");
	}

	// Set a watcher on the status_update_interval setting
	watchSetting("status_update_interval", (newVal) => {
		startPolling();
	});

	startPolling();

	// Fetch the initial updates ftom the server.
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
	updateUserLocation(gpsData.detail);
	updateUserLocationOnMap(true);
});

// Reaper Log from a Reaper Node
window.bus.addEventListener("bus:log_update", (logData) => {
	//console.log("Reaper Log:", logData.detail);
});

// Listen for Reaper Node Group Message
window.bus.addEventListener("bus:reaper_node_received_global_message", (message) => {
	if (appSettings.showNewGroupMessagePopup) {
		showPopupNotification("New Global Message", message.detail.device_name + "<br/>" + message.detail.message);
	}
});

// Listen for Reaper Node Direct Message
window.bus.addEventListener("bus:reaper_node_received_direct_message", (message) => {
	if (appSettings.showNewDirectMessagePopup) {
		showPopupNotification("New Direct Message", message.detail.device_name + "<br/>" + message.detail.message);
	}
});

// Listen for Reaper Node Beacon Message
window.bus.addEventListener("bus:reaper_node_received_beacon", (message) => {
	//console.log("Beacon Message:", message.detail);
	updateNodeMarkers(); // Update the node markers on the map.
});

// Listen for Reaper Node Command Send
window.bus.addEventListener("bus:send_reaper_command", (cmd) => {
	if (reaperNodeSocket) {
		sendCommandToReaperNode(cmd.detail);
	} else {
		console.error("Reaper Node Socket is not connected.");
	}
});

// Listen for a Reaper Node sending a global message
window.bus.addEventListener("bus:reaper_node_send_gloabl_message", (msg) => {

});

// Listen for a Reaper Node sending a direct message
window.bus.addEventListener("bus:reaper_node_send_direct_message", (msg) => {
	//console.log("Direct Message:", msg.detail);
});
