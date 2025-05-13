function toggleSidebar(side) {
	document.getElementById(`${side}-sidebar`).classList.toggle("collapsed");
}

function openTool(name) {
	document.getElementById("tool-content").innerHTML = name === "chat" ? "<h5>Communication</h5><p>Chat UI goes here</p>" : name === "team" ? "<h5>Team Tracker</h5><p>Map team positions</p>" : "No tool selected";
}

let map,
	georasterLayer = null,
	markers = [];

$(document).ready(function () {
	// Initialize the map
	map = L.map("map").setView([41.0128, -81.6054], 10);
	//L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
	const arcGISSat = L.tileLayer("https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
		minZoom: 6,
		maxZoom: 19,
		attribution: 'Map data © <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
	});

	arcGISSat.addTo(map);

	// CHANGE TO CLICK ON MARKER TO OPEN POPUP
	//$(".btn").on("click", function () {
	//	$("#sendMessageWindow").show(1);
	//});

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
	loadMarkers();
});
