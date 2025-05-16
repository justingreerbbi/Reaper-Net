// main.js (Modular version)
import { makeDraggable } from "./parts/helpers.js";
import { startReaperNodeSocket, updateReaperNodeContent, reaperNodeSocket } from "./parts/reaper-node.js";

let map;
let markers = [];
let systemTimer;

let status = {
	internetConnected: false,
	reaperNodeConnected: false,
	reaperNodeName: "",
	reaperNodePort: "",
	gpsDevice: "",
	gpsConnected: false,
};

function createTacticalMarker(lat, lng, type, iconName) {
	const iconHtml = `
    <div class="tactical-marker ${type}">
      <i class="bi bi-${iconName}"></i>
    </div>
  `;

	const icon = L.divIcon({
		className: "",
		html: iconHtml,
		iconSize: [40, 40],
		iconAnchor: [20, 20],
	});

	const marker = L.marker([lat, lng], { icon }).addTo(map);
	marker.bindPopup(`
    <div class="popup-content">
      <h5>${type.charAt(0).toUpperCase() + type.slice(1)}</h5>
      <p>Coordinates: ${lat}, ${lng}</p>
    </div>
  `);
	marker.on("click", function () {
		this.openPopup();
	});
	return marker;
}

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

			if (status.reaperNodeConnected && !reaperNodeSocket) {
				startReaperNodeSocket();
			}

			console.log("Status Data:", data);
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

	function runSystemTimer() {
		getServerStatusAndUpdate();
		updateReaperNodeContent();
		// loadMarkers();
	}

	systemTimer = setInterval(runSystemTimer, 5 * 60 * 1000);
	runSystemTimer();
});
