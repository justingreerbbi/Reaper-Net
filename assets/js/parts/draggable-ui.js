const toolbar = document.getElementById("toolbar");
let isDragging = false;
let offsetX, offsetY;

const initialTop = 100;
const initialLeft = 10;
const snapThreshold = 20; // pixels

// Restore position from localStorage
window.addEventListener("DOMContentLoaded", () => {
	const savedLeft = localStorage.getItem("toolbarLeft");
	const savedTop = localStorage.getItem("toolbarTop");
	if (savedLeft && savedTop) {
		toolbar.style.left = savedLeft;
		toolbar.style.top = savedTop;
	}
});

// Handle dragging
toolbar.addEventListener("mousedown", (e) => {
	isDragging = true;
	offsetX = e.clientX - toolbar.offsetLeft;
	offsetY = e.clientY - toolbar.offsetTop;
	toolbar.style.cursor = "grabbing";
});

document.addEventListener("mousemove", (e) => {
	if (isDragging) {
		const left = e.clientX - offsetX;
		const top = e.clientY - offsetY;
		toolbar.style.left = `${left}px`;
		toolbar.style.top = `${top}px`;
	}
});

document.addEventListener("mouseup", () => {
	if (isDragging) {
		const currentLeft = parseInt(toolbar.style.left);
		const currentTop = parseInt(toolbar.style.top);

		const distLeft = Math.abs(currentLeft - initialLeft);
		const distTop = Math.abs(currentTop - initialTop);

		if (distLeft < snapThreshold && distTop < snapThreshold) {
			// Snap to original location
			toolbar.style.left = `${initialLeft}px`;
			toolbar.style.top = `${initialTop}px`;
			localStorage.removeItem("toolbarLeft");
			localStorage.removeItem("toolbarTop");
		} else {
			// Save new position
			localStorage.setItem("toolbarLeft", toolbar.style.left);
			localStorage.setItem("toolbarTop", toolbar.style.top);
		}
	}
	isDragging = false;
	toolbar.style.cursor = "move";
});
