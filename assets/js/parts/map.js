export let isFollowingUserLocation = false;

const MARKERS_STORAGE_KEY = "custom_map_markers";
let customMarkers = [];

/* ───── Storage ───── */
function loadMarkersFromStorage() {
	return JSON.parse(localStorage.getItem(MARKERS_STORAGE_KEY) || "[]");
}
function saveMarkersToStorage() {
	// Strip leaflet marker refs before saving
	const plainMarkers = customMarkers.map(({ _leafletMarker, ...rest }) => rest);
	localStorage.setItem(MARKERS_STORAGE_KEY, JSON.stringify(plainMarkers));
}

/* ───── Create Marker ───── */
function createCustomMarker(markerData) {
	const iconHtml = `
		<div style="width:24px;height:24px;border-radius:50%;background:${markerData.color};border:2px solid #222;display:flex;align-items:center;justify-content:center;font-size:14px;">
			${markerData.type}
		</div>`;
	const icon = L.divIcon({ className: "", html: iconHtml, iconSize: [24, 24], iconAnchor: [12, 24] });

	const marker = L.marker([markerData.lat, markerData.lng], { icon }).addTo(window.map);
	marker.bindPopup(generatePopupHTML(markerData));

	marker.on("popupopen", () => {
		setTimeout(() => {
			document.querySelector(`.marker-edit-btn[data-id="${markerData.id}"]`)?.addEventListener("click", () => openMarkerModal(markerData));
			document.querySelector(`.marker-delete-btn[data-id="${markerData.id}"]`)?.addEventListener("click", () => deleteMarker(markerData.id));
			document.querySelector(`.marker-share-btn[data-id="${markerData.id}"]`)?.addEventListener("click", () => console.log(markerData));
		}, 0);
	});

	// Store marker reference and update in list
	const existingIndex = customMarkers.findIndex((m) => m.id === markerData.id);
	if (existingIndex !== -1) {
		customMarkers[existingIndex] = { ...markerData, _leafletMarker: marker };
	} else {
		customMarkers.push({ ...markerData, _leafletMarker: marker });
	}
	saveMarkersToStorage();
	return marker;
}

function generatePopupHTML(markerData) {
	return `
		<div>
			<strong>${markerData.name}</strong><br>
			Type: ${markerData.type}<br>
			Color: <span style="display:inline-block;width:12px;height:12px;background:${markerData.color};border-radius:50%;"></span><br>
			Lat: ${markerData.lat.toFixed(6)}<br>
			Lng: ${markerData.lng.toFixed(6)}<br>
			${markerData.description ? `<div>${markerData.description}</div>` : ""}
			<div class="mt-2">
				<button class="btn btn-sm btn-outline-primary marker-edit-btn" data-id="${markerData.id}">Edit</button>
				<button class="btn btn-sm btn-outline-danger marker-delete-btn" data-id="${markerData.id}">Delete</button>
				<button class="btn btn-sm btn-outline-secondary marker-share-btn" data-id="${markerData.id}">Share</button>
			</div>
		</div>`;
}

/* ───── Modal ───── */
function openMarkerModal(markerData = null) {
	const isEdit = markerData && !!markerData.id;
	const modalId = "markerModal";
	document.getElementById(modalId)?.remove();

	const modal = document.createElement("div");
	modal.className = "modal fade";
	modal.id = modalId;
	modal.tabIndex = -1;
	modal.innerHTML = `
		<div class="modal-dialog draggable">
			<div class="modal-content">
				<div class="modal-header">
					<h5 class="modal-title">${isEdit ? "Edit Marker" : "Add Marker"}</h5>
					<button type="button" class="btn-close" data-bs-dismiss="modal"></button>
				</div>
				<div class="modal-body">
					<form id="marker-form">
						<input class="form-control mb-2" name="name" placeholder="Name" required />
						<select class="form-select mb-2" name="type" required>
							<option value="▲">Infantry</option>
							<option value="■">Armor</option>
							<option value="●">Artillery</option>
							<option value="▶">Air</option>
							<option value="◆">Support</option>
						</select>
						<select class="form-select mb-2" name="color" required>
							<option value="#2196f3">Blue</option>
							<option value="#f44336">Red</option>
							<option value="#4caf50">Green</option>
							<option value="#ffeb3b">Yellow</option>
							<option value="#9e9e9e">Gray</option>
							<option value="#000000">Black</option>
						</select>
						<input class="form-control mb-2" name="lat" placeholder="Latitude" type="number" step="any" required />
						<input class="form-control mb-2" name="lng" placeholder="Longitude" type="number" step="any" required />
						<textarea class="form-control mb-2" name="description" rows="2" placeholder="Description"></textarea>
						<button type="submit" class="btn btn-primary w-100">Save Marker</button>
					</form>
				</div>
			</div>
		</div>
	`;
	document.body.appendChild(modal);

	const form = modal.querySelector("#marker-form");
	form.reset();

	if (markerData) {
		form.elements["name"].value = markerData.name ?? "";
		form.elements["type"].value = markerData.type ?? "▲";
		form.elements["color"].value = markerData.color ?? "#2196f3";
		form.elements["lat"].value = markerData.lat ?? "";
		form.elements["lng"].value = markerData.lng ?? "";
		form.elements["description"].value = markerData.description ?? "";
	}

	form.onsubmit = (e) => {
		e.preventDefault();
		const data = {
			id: markerData?.id || crypto.randomUUID(),
			name: form.elements["name"].value,
			type: form.elements["type"].value,
			color: form.elements["color"].value,
			lat: parseFloat(form.elements["lat"].value),
			lng: parseFloat(form.elements["lng"].value),
			description: form.elements["description"].value,
		};

		// Remove old marker if editing
		if (isEdit) {
			const existing = customMarkers.find((m) => m.id === data.id);
			if (existing && existing._leafletMarker) {
				window.map.removeLayer(existing._leafletMarker);
			}
		}
		createCustomMarker(data);
		bootstrap.Modal.getInstance(modal).hide();
	};

	bootstrap.Modal.getOrCreateInstance(modal).show();
	modal.addEventListener("hidden.bs.modal", () => modal.remove());
	enableModalDragging(modal);
}

/* ───── Make Modal Draggable ───── */
function enableModalDragging(modal) {
	const header = modal.querySelector(".modal-header");
	const dialog = modal.querySelector(".modal-dialog");

	let isDragging = false,
		offsetX = 0,
		offsetY = 0;
	header.style.cursor = "move";

	header.addEventListener("mousedown", (e) => {
		isDragging = true;
		offsetX = e.clientX - dialog.offsetLeft;
		offsetY = e.clientY - dialog.offsetTop;
		dialog.style.margin = "0";
		dialog.style.position = "absolute";
	});

	document.addEventListener("mousemove", (e) => {
		if (isDragging) {
			dialog.style.left = `${e.clientX - offsetX}px`;
			dialog.style.top = `${e.clientY - offsetY}px`;
		}
	});

	document.addEventListener("mouseup", () => {
		isDragging = false;
	});
}

/* ───── Delete Marker ───── */
function deleteMarker(id) {
	const idx = customMarkers.findIndex((m) => m.id === id);
	if (idx !== -1) {
		const marker = customMarkers[idx]._leafletMarker;
		if (marker) window.map.removeLayer(marker);
		customMarkers.splice(idx, 1);
		saveMarkersToStorage();
	}
}

/* ───── Animate Movement ───── */
export function moveMarkerSmoothly(marker, newLatLng, duration = 500) {
	let start = null;
	const from = marker.getLatLng();
	const to = L.latLng(newLatLng);

	function animate(timestamp) {
		if (!start) start = timestamp;
		const progress = Math.min((timestamp - start) / duration, 1);
		const lat = from.lat + (to.lat - from.lat) * progress;
		const lng = from.lng + (to.lng - from.lng) * progress;
		marker.setLatLng([lat, lng]);
		if (progress < 1) requestAnimationFrame(animate);
	}
	requestAnimationFrame(animate);
}

/* ───── User Location ───── */
export function updateUserLocation(data) {
	const requiredFields = ["latitude", "longitude", "altitude", "speed", "heading", "satellites"];
	for (const field of requiredFields) {
		if (data[field] === undefined || data[field] === null) {
			console.error(`Missing user location field: ${field}`);
			return;
		}
	}
	window.userLocation = {
		latitude: data.latitude,
		longitude: data.longitude,
		speed: data.speed,
		heading: data.heading,
		altitude: data.altitude,
		satellites: data.satellites,
		timestamp: new Date().toISOString(),
	};
}

export function updateUserLocationOnMap() {
	if (!window.userLocation) return;
	const { latitude, longitude, speed, heading, altitude, satellites } = window.userLocation;

	if (!window.userLocationMarker) {
		const blueCircleIcon = L.divIcon({
			className: "",
			html: `<div style="width:18px;height:18px;border:2px solid #fff;border-radius:50%;background:#2196f3;box-shadow:0 0 4px #2196f3;"></div>`,
			iconSize: [18, 18],
			iconAnchor: [9, 9],
		});
		window.userLocationMarker = L.marker([latitude, longitude], { icon: blueCircleIcon }).addTo(window.map);
		window.userLocationMarker.bindPopup(`
			<div class="marker-popup">
				<h4>Your Position</h4>
				<div>${latitude}, ${longitude}</div>
				<div>Speed: ${speed} km/h</div>
				<div>Altitude: ${altitude} m</div>
				<div>Heading: ${heading}°</div>
				<div>Satellites: ${satellites}</div>
			</div>`);
		centerMapOnUserLocation();
	} else {
		moveMarkerSmoothly(window.userLocationMarker, [latitude, longitude]);
		if (isFollowingUserLocation) window.map.setView([latitude, longitude]);
	}
}

export function removeUserLocationMarker() {
	if (window.userLocationMarker) {
		window.map.removeLayer(window.userLocationMarker);
		window.userLocationMarker = null;
	}
}

export function centerMapOnUserLocation() {
	if (window.userLocation) {
		const { latitude, longitude } = window.userLocation;
		window.map.setView([latitude, longitude]);
	}
}

export function setFollowUserLocation(follow) {
	isFollowingUserLocation = follow;
	if (follow) centerMapOnUserLocation();
	else document.getElementById("center-on-location-btn")?.classList.remove("active");
}

export function toggleFollowUserLocation() {
	isFollowingUserLocation = !isFollowingUserLocation;
	if (isFollowingUserLocation) centerMapOnUserLocation();
	const btn = document.getElementById("center-on-location-btn");
	btn?.classList.toggle("active", isFollowingUserLocation);
}

/**
 * Adds a button to the map toolbar.
 *
 * Gives plugins the ability to add a custom button to the map toolbar and control what happens when the button is clicked.
 *
 * @param {string} buttonId - The ID for the button.
 * @param {string} iconHtml - HTML string for the button icon.
 * @param {string} tooltipText - Tooltip text for the button.
 * @param {function} onClick - Function to call when the button is clicked.
 * @returns {void}
 */
export function addButtonToToolbar(buttonId, iconHtml, tooltipText, onClick) {
	const toolbar = document.getElementById("map-toolbar");
	if (!toolbar) return;

	const button = document.createElement("button");
	button.id = buttonId;
	button.className = "btn btn-secondary";
	button.innerHTML = iconHtml;
	button.title = tooltipText;
	button.addEventListener("click", onClick);
	toolbar.appendChild(button);
}

/* ───── Init ───── */
window.addEventListener("DOMContentLoaded", () => {
	customMarkers = loadMarkersFromStorage();
	customMarkers.forEach((data) => {
		createCustomMarker(data); // this now also pushes back into customMarkers with _leafletMarker
	});

	// Add marker on long click (hold for 600ms)
	let longClickTimer = null;
	let longClickLatLng = null;

	window.map.on("mousedown", (e) => {
		longClickLatLng = e.latlng;
		longClickTimer = setTimeout(() => {
			openMarkerModal({
				id: crypto.randomUUID(),
				name: "",
				type: "▲",
				color: "#2196f3",
				lat: longClickLatLng.lat,
				lng: longClickLatLng.lng,
				description: "",
			});
			longClickTimer = null;
		}, 600); // 600ms for long click
	});

	window.map.on("mouseup", () => {
		if (longClickTimer) {
			clearTimeout(longClickTimer);
			longClickTimer = null;
		}
	});

	window.map.on("mousemove", () => {
		if (longClickTimer) {
			clearTimeout(longClickTimer);
			longClickTimer = null;
		}
	});
});
