
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
export async function updateUserLocation(data) {
    return new Promise((resolve, reject) => {
        const requiredFields = ['lat', 'lng', 'alt', 'speed', 'heading', 'satellites'];
        for (const field of requiredFields) {
            if (data[field] === undefined || data[field] === null) {
                console.error(`Missing user location field: ${field}`);
                reject(new Error(`Missing user location field: ${field}`));
                return;
            }
        }
        window.userLocation = {
            lat: data.lat,
            lng: data.lng,
            accuracy: data.accuracy,
            speed: data.speed,
            heading: data.heading,
            altitude: data.altitude,
            timestamp: new Date().toISOString(),
        };
        resolve(window.userLocation);
    });
}

/**
 * Udpate the user location marker on the map.
 * 
 * @todo: We may need to add a check if the marker is already moving if an new update comes in. I am not sure how this will work yet when the user is moving fast.
 */
export function updateUserLocationOnMap() {
    if (window.userLocation) {
        const { lat, lng, accuracy, speed, heading, altitude, timestamp } = window.userLocation;
        if (!window.userLocationMarker) {
            const blueCircleIcon = L.divIcon({
                className: '',
                html: `<div style="width:18px;height:18px;border:2px solid #fff;border-radius:50%;background:#2196f3;box-shadow:0 0 4px #2196f3;"></div>`,
                iconSize: [18, 18],
                iconAnchor: [9, 9]
            });
            window.userLocationMarker = L.marker([lat, lng], { icon: blueCircleIcon }).addTo(window.map);
        } else {
            // Move the marker smoothly to the new location
            moveMarkerSmoothly(window.userLocationMarker, [lat, lng]);
            if (isFollowingUserLocation) {
                window.map.setView([lat, lng]);
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
        const { lat, lng } = window.userLocation;
        window.map.setView([lat, lng]);
    } else {
        console.error("User location data is not available.");
    }
}

/**
 * Set the map to follow the user location or not.
 */
export function setFollowUserLocation(follow) {
    console.log("Setting the Follow User Location to: ", follow);
    isFollowingUserLocation = follow;
    if (follow) {
        centerMapOnUserLocation();
    } else {
        const btn = document.getElementById('center-on-location-btn');
        if (btn) {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', false);
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

    const btn = document.getElementById('center-on-location-btn');
    if (btn) {
        btn.classList.toggle('active', isFollowingUserLocation);
        btn.setAttribute('aria-pressed', isFollowingUserLocation);
    }
}