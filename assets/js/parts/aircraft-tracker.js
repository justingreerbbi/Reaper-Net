/**
 * Aircraft Tracker Module
 *
 */

window.aircraftMapMarkers = [];
window.aircraft = [];

/**
 * Initializes the Aircraft Tracker module.
 * This function is a placeholder for future implementation.
 */
export function updateAircraft() {
	fetch("/api/aircraft")
		.then((response) => response.json())
		.then((data) => {
			window.aircraftMapMarkers = data;
			if (data && typeof data === "object" && !Array.isArray(data)) {
				window.aircraft = Object.values(data);
			}
			window.bus.dispatchEvent(new CustomEvent("bus:update_aircraft_markers", { detail: window.aircraft }));
		})
		.catch((error) => {
			console.error("Error fetching aircraft data:", error);
		});
}

export function enableAircraftTracker() {
	// Placeholder for enabling the aircraft tracker functionality
	console.log("Aircraft Tracker enabled");
}

export function disableAircraftTracker() {
	// Placeholder for disabling the aircraft tracker functionality
	console.log("Aircraft Tracker disabled");
}

function updateAircraftMarkersOnMap() {
	// Placeholder for putting aircraft markers on the map
	// This function would typically loop through aircraftMarkers and add them to the map

	if (!window.aircraft || !Array.isArray(window.aircraft)) return;
	if (!window.map) return;

	//console.log("There are " + window.aircraftMapMarkers.length + " aircraft markers to process.");

	window.aircraft.forEach((markerData) => {
		// Define each property as null by default
		let aircraft_id = null;
		let alert = null;
		let altitude = null;
		let flight_id = null;
		let generated_date = null;
		let generated_time = null;
		let ground_speed = null;
		let hex_ident = null;
		let is_on_ground = null;
		let last_seen = null;
		let logged_date = null;
		let logged_time = null;
		let message_type = null;
		let session_id = null;
		let spi = null;
		let track = null;
		let transmission_type = null;
		let vertical_rate = null;
		let lat = null;
		let lon = null;
		let id = null;
		let emergency = false;

		// Assign each property if it exists in markerData
		if ("aircraft_id" in markerData) aircraft_id = markerData.aircraft_id;
		if ("alert" in markerData) alert = markerData.alert;
		if ("altitude" in markerData) altitude = markerData.altitude;
		if ("flight_id" in markerData) flight_id = markerData.flight_id;
		if ("generated_date" in markerData) generated_date = markerData.generated_date;
		if ("generated_time" in markerData) generated_time = markerData.generated_time;
		if ("ground_speed" in markerData) ground_speed = markerData.ground_speed;
		if ("hex_ident" in markerData) hex_ident = markerData.hex_ident;
		if ("is_on_ground" in markerData) is_on_ground = markerData.is_on_ground;
		if ("last_seen" in markerData) last_seen = markerData.last_seen;
		if ("logged_date" in markerData) logged_date = markerData.logged_date;
		if ("logged_time" in markerData) logged_time = markerData.logged_time;
		if ("message_type" in markerData) message_type = markerData.message_type;
		if ("session_id" in markerData) session_id = markerData.session_id;
		if ("spi" in markerData) spi = markerData.spi;
		if ("track" in markerData) track = markerData.track;
		if ("transmission_type" in markerData) transmission_type = markerData.transmission_type;
		if ("vertical_rate" in markerData) vertical_rate = markerData.vertical_rate;
		if ("lat" in markerData) lat = parseFloat(markerData.lat);
		if ("lon" in markerData) lon = parseFloat(markerData.lon);
		if ("id" in markerData) id = markerData.id;
		if ("emergency" in markerData) emergency = markerData.emergency;

		// Use aircraft_id as the unique marker id, fallback to id if needed
		const markerId = aircraft_id || id;
		if (typeof lat !== "number" || typeof lon !== "number" || !markerId) return;

		window.aircraftMapMarkers = window.aircraftMapMarkers || {};

		const label = markerData.callsign || hex_ident || "N/A";
		const iconColor = emergency ? "#e00" : "#0f0"; // Red for emergency, green otherwise

		// HTML content with label
		const iconHtml = `
		<div style="text-align:center;">
			<div style="width:12px;height:12px;border-radius:50%;background:${emergency};border:1px solid #000;margin:auto;"></div>
			<div style="font-size:12px;color:#fff;text-shadow:0 0 3px #000;margin-top:2px;">${label}</div>
		</div>`;

		const icon = L.divIcon({
			className: "",
			html: iconHtml,
			iconSize: [50, 30],
			iconAnchor: [25, 15], // center the icon at marker point
		});

		let marker = window.aircraftMapMarkers[markerId];
		if (!marker) {
			marker = L.marker([lat, lon], { icon }).addTo(window.map);
			window.aircraftMapMarkers[markerId] = marker;
		} else {
			marker.setLatLng([lat, lon]);
			marker.setIcon(icon); // update label if changed
		}
	});
}
