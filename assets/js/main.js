// main.js (Modular version)
import { getSetting, updateSetting, watchSetting } from "./parts/settings.js";
import { makeDraggable } from "./parts/helpers.js";
import { startReaperNodeSocket, updateReaperNodeContent, reaperNodeSocket } from "./parts/reaper-node.js";
import { listPlugins, getPlugin } from "./parts/pluginManager.js";

//import { createInfoModal, createConfirmModal } from "./parts/notifications.js";

let map;
let markers = [];
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

function loadMarkers() {
	markers.forEach((marker) => map.hasLayer(marker) && map.removeLayer(marker));
	markers = [];

	fetch("/api/markers")
		.then((res) => res.json())
		.then((data) => {
			data.forEach((marker) => {
				const m = createTacticalMarker(marker.latitude, marker.longitude, "infantry", "person-fill");
				markers.push(m);
			});
		})
		.catch((error) => console.error("Error loading markers:", error));
}

function setupMap() {
	map = L.map("map").setView([41.0128, -81.6054], 10);
	L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
		minZoom: 6,
		maxZoom: 19,
		attribution: 'Map data © <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
	}).addTo(map);

	map.on("click", (e) => {
		const lat = e.latlng.lat.toFixed(5);
		const lng = e.latlng.lng.toFixed(5);
		const modalHtml = `
      <div id="map-modal" class="modal" style="display:block;background:rgba(0,0,0,0.5);">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title">Add Marker</h5></div>
            <div class="modal-body">
              <p>Coordinates: <span>${lat},${lng}</span></p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-primary" id="save-marker-btn">Save Marker</button>
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('map-modal').remove();">Close</button>
            </div>
          </div>
        </div>
      </div>`;
		document.body.insertAdjacentHTML("beforeend", modalHtml);
		document.getElementById("save-marker-btn").onclick = () => {
			fetch("/api/save_marker", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ latitude: lat, longitude: lng }),
			})
				.then(() => {
					console.log("Marker saved successfully");
					document.getElementById("map-modal").remove();
					loadMarkers();
				})
				.catch((error) => {
					console.error("Error saving marker:", error);
					alert("Failed to save marker.");
				});
		};
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
		//loadMarkers();
		updateMemoryUsage();
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
