/**
 * Aircraft Tracker Module
 *
 */

window.aircraftMapMarkers = [];
window.aircraft = [];

export let aircraftTrackerSocket = null;

export function initAircraftTracker() {
	aircraftTrackerSocket = io();
	aircraftTrackerSocket.on("aircraft_data", (data) => {
		handleAircraftData(data);
	});
}

function handleAircraftData(data) {
	// This function processes incoming aircraft data
	// It can be used to update the map or perform other actions
	//console.log("Processing aircraft data:", data);
	if (data && typeof data === "object" && !Array.isArray(data)) {
		window.aircraft = Object.values(data);
	}
	window.bus.dispatchEvent(new CustomEvent("bus:update_aircraft_markers", { detail: window.aircraft }));
}
