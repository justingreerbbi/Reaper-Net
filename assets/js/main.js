let map;
let markers = [];
let systemTimer;

let internet_connected = false;
let reaper_node_connected = false;
let reaper_node_name = "";
let reaper_node_port = "";
let gps_device = "";
let gps_connected = false;

function makeDraggable(modalElement) {
	let pos1 = 0,
		pos2 = 0,
		pos3 = 0,
		pos4 = 0;

	const dragMouseDown = (e) => {
		pos3 = e.clientX;
		pos4 = e.clientY;

		document.onmouseup = closeDragElement;
		document.onmousemove = elementDrag;
	};

	const elementDrag = (e) => {
		pos1 = pos3 - e.clientX;
		pos2 = pos4 - e.clientY;
		pos3 = e.clientX;
		pos4 = e.clientY;

		modalElement.style.top = modalElement.offsetTop - pos2 + "px";
		modalElement.style.left = modalElement.offsetLeft - pos1 + "px";
	};

	const closeDragElement = () => {
		document.onmouseup = null;
		document.onmousemove = null;
	};

	if (modalElement.querySelector(".modal-header")) {
		modalElement.querySelector(".modal-header").onmousedown = dragMouseDown;
	} else {
		modalElement.onmousedown = dragMouseDown;
	}
}

$(document).ready(function () {
	// Initialize the map
	map = L.map("map").setView([41.0128, -81.6054], 10);
	const baseMapLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
		//const baseMapLayer = L.tileLayer("https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
		minZoom: 6,
		maxZoom: 19,
		attribution: 'Map data © <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
	});
	baseMapLayer.addTo(map);

	// CHANGE TO CLICK ON MARKER TO OPEN POPUP
	//$(".btn").on("click", function () {
	//	$("#sendMessageWindow").show(1);
	//});

	// Make all modals draggable
	$(".modal").each(function () {
		makeDraggable(this);
	});

	/**
	 * CUSTOMER MARKERS
	 */
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

		return marker; // ✅ This was missing
	}

	/**
	 * ON MAP HOVER/MOUSE MOVE
	 */
	map.on("mousemove", function (e) {
		//document.getElementById("coords-display").innerText = `Lat: ${e.latlng.lat.toFixed(5)}, Lng: ${e.latlng.lng.toFixed(5)}`;
	});

	/**
	 * MAP CLICK TO ADD MARKER
	 */
	map.on("click", function (e) {
		const lat = e.latlng.lat.toFixed(5);
		const lng = e.latlng.lng.toFixed(5);
		const modalHtml = `
					<div id="map-modal" class="modal" tabindex="-1" role="dialog" style="display: block; background: rgba(0, 0, 0, 0.5);">
						<div class="modal-dialog" role="document">
							<div class="modal-content">
								<div class="modal-header">
									<h5 class="modal-title">Add Marker</h5>
								</div>
								<div class="modal-body">
									<p>
										Coordinates: <span>${lat},${lng}</span>
									</p>
								</div>
								<div class="modal-footer">
									<button type="button" class="btn btn-primary" id="save-marker-btn">Save Marker</button>
									<button type="button" class="btn btn-secondary" onclick="$('#map-modal').remove();">Close</button>
								</div>
							</div>
						</div>
					</div>`;
		$("body").append(modalHtml);
		$("#save-marker-btn").on("click", function () {
			$.ajax({
				url: "/api/save_marker",
				method: "POST",
				contentType: "application/json",
				data: JSON.stringify({ latitude: lat, longitude: lng }),
				success: function () {
					console.log("Marker saved successfully");
					$("#map-modal").remove();
					loadMarkers();
				},
				error: function (error) {
					console.error("Error saving marker:", error);
					alert("Failed to save marker.");
				},
			});
		});
	});

	/**
	 * LOAD ALL THE MARKERS ON THE MAP
	 */
	function loadMarkers() {
		markers.forEach((marker) => {
			if (marker && map.hasLayer(marker)) {
				map.removeLayer(marker);
			}
		});
		markers = [];

		$.ajax({
			url: "/api/markers",
			method: "GET",
			success: function (data) {
				data.forEach((marker) => {
					// You can make this dynamic later with marker.type and marker.icon
					const m = createTacticalMarker(marker.latitude, marker.longitude, "infantry", "person-fill");
					markers.push(m);
				});
			},
			error: function (error) {
				console.error("Error loading markers:", error);
			},
		});
	}
	//loadMarkers();

	/**
	 * GET THE API SERVER STATUS
	 *
	 * Query the server status and update global variables
	 * as needed. This function can be called periodically to get the latest server status.
	 */
	function getServerStatusAndUpdate() {
		$.ajax({
			url: "/api/status",
			method: "GET",
			dataType: "json",
			success: function (data) {
				internet_connected = data.internet_connected;
				reaper_node_connected = data.reaper_node_connected;
				reaper_node_name = data.reaper_node_name;
				reaper_node_port = data.reaper_node_port;
				gps_device = data.gps_device;
				gps_connected = data.gps_connected;

				// Update the UI or perform actions based on the status
				if (internet_connected) {
					$("#internet-connection-status").html('<i class="bi bi-check-square-fill text-success"></i>');
				} else {
					$("#internet-connection-status").html('<i class="bi bi-x-square-fill text-danger"></i>');
				}

				// REAPER NODE MONITOR START
				if (reaper_node_connected && reaper_node_script_loaded) {
					$("#reaper-node-status").html('<i class="bi bi-check-square-fill text-success"></i>');
					if (!reaper_node_socket_loaded) {
						reaper_node_socket_loaded = true;
						start_reaper_node_socket();
					}
				} else {
					$("#reaper-node-status").html('<i class="bi bi-x-square-fill text-danger"></i>');
				}

				if (gps_connected) {
					$("#gps-status").html('<i class="bi bi-check-square-fill text-success"></i>');
				} else {
					$("#gps-status").html('<i class="bi bi-x-square-fill text-danger"></i>');
				}

				console.log("Status Data:", data);
			},
			error: function (error) {
				console.error("Error fetching status:", error);
			},
		});
	}

	/**
	 * SYSTEM TIMER TO RUN ON LOAD AND THEN EVERY 5 MINUTES
	 */
	function runSystemTimer() {
		getServerStatusAndUpdate();
		//loadMarkers();
	}
	systemTimer = setInterval(runSystemTimer, 5 * 60 * 1000); // 5 minutes
	runSystemTimer(); // Initial call to load data immediately
});
