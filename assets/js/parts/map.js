/**
 * Map Module
 *
 * @todo: We need to migrate the rest of the map init code over to this module when we get a chance. Let's try to keep it as clean as possible.
 */

/**
 * Animate a marker instead of snaping.
 *
 * @param {*} marker
 * @param {*} newLatLng
 * @param {*} duration
 */

export let isFollowingUserLocation = false;

export function moveMarkerSmoothly(marker, newLatLng, duration = 500) {
	let start = null;
	let from = marker.getLatLng();
	let to = L.latLng(newLatLng);

	function animate(timestamp) {
		if (!start) start = timestamp;
		let progress = (timestamp - start) / duration;
		if (progress > 1) progress = 1;

		let lat = from.lat + (to.lat - from.lat) * progress;
		let lng = from.lng + (to.lng - from.lng) * progress;

		marker.setLatLng([lat, lng]);

		if (progress < 1) {
			requestAnimationFrame(animate);
		}
	}

	requestAnimationFrame(animate);
}

/**
 * Updates the user location data object.
 *
 * @param {Object} data - The data object containing user location information.
 *
 * @returns {Promise} - A promise that resolves with the updated user location data.
 */
export function updateUserLocation(data) {
	//return new Promise((resolve, reject) => {
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
	//resolve(window.userLocation);
	//});
}

/**
 * Update the user location marker on the map.
 *
 * @todo: We may need to add a check if the marker is already moving if an new update comes in. I am not sure how this will work yet when the user is moving fast.
 */
export function updateUserLocationOnMap() {
	if (window.userLocation) {
		const latitude = window.userLocation.latitude;
		const longitude = window.userLocation.longitude;
		const speed = window.userLocation.speed;
		const heading = window.userLocation.heading;
		const altitude = window.userLocation.altitude;
		const satellites = window.userLocation.satellites;

		if (!window.userLocationMarker) {
			const blueCircleIcon = L.divIcon({
				className: "",
				html: `<div style="width:18px;height:18px;border:2px solid #fff;border-radius:50%;background:#2196f3;box-shadow:0 0 4px #2196f3;"></div>`,
				iconSize: [18, 18],
				iconAnchor: [9, 9],
			});
			window.userLocationMarker = L.marker([latitude, longitude], { icon: blueCircleIcon }).addTo(window.map);
			window.userLocationMarker.bindPopup(
				`<div class="marker-popup">
					<h4>Your Position</h4>
					<div>${latitude}, ${longitude}</div>
					<div>Speed: ${speed} km/h</div>
					<div>Altitude: ${altitude} m</div>
					<div>Heading: ${heading}°</div>		
					<div>Satellites: ${satellites}</div>
				</div>`
			);
			//if (centerOnLocation) {
			centerMapOnUserLocation();
			//}
		} else {
			// Move the marker smoothly to the new location
			moveMarkerSmoothly(window.userLocationMarker, [latitude, longitude]);
			if (isFollowingUserLocation) {
				window.map.setView([latitude, longitude]);
			}
		}
	} else {
		console.error("User location data is not available.");
	}
}

/**
 * Removes the user location marker from the map.
 */
export function removeUserLocationMarker() {
	if (window.userLocationMarker) {
		window.map.removeLayer(window.userLocationMarker);
		window.userLocationMarker = null;
	}
}

/**
 * Centers the map on the users location.
 */
export function centerMapOnUserLocation() {
	if (window.userLocation) {
		const { latitude, longitude } = window.userLocation;
		window.map.setView([latitude, longitude]);
	} else {
		console.error("User location data is not available.");
	}
}

/**
 * Set the map to follow the user location or not.
 */
export function setFollowUserLocation(follow) {
	//console.log("Setting the Follow User Location to: ", follow);
	isFollowingUserLocation = follow;
	if (follow) {
		centerMapOnUserLocation();
	} else {
		const btn = document.getElementById("center-on-location-btn");
		if (btn) {
			btn.classList.remove("active");
			btn.setAttribute("aria-pressed", false);
		}
	}
}

/**
 * Toggle follow user location
 */
export function toggleFollowUserLocation() {
	isFollowingUserLocation = !isFollowingUserLocation;
	if (isFollowingUserLocation) {
		centerMapOnUserLocation();
	}

	const btn = document.getElementById("center-on-location-btn");
	if (btn) {
		btn.classList.toggle("active", isFollowingUserLocation);
		btn.setAttribute("aria-pressed", isFollowingUserLocation);
	}
}
