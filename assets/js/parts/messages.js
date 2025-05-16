let sendMessageWindowOffsetX, sendMessageWindowOffsetY;
let isDraggingSendMessageWindow = false;

/**
 * Sets a quick message in the send message textarea.
 * @param {string} message - The message to insert.
 */
export function quickMessage(message) {
	const textarea = document.querySelector("#sendMessageWindow textarea");
	if (textarea) {
		textarea.value = message;
	}
}

/**
 * Enables drag functionality on the sendMessageWindow.
 */
export function initSendMessageWindow() {
	const sendMessageWindow = document.getElementById("sendMessageWindow");
	if (!sendMessageWindow) return;

	sendMessageWindow.style.display = "block";

	const header = sendMessageWindow.querySelector("div");
	if (!header) return;

	header.addEventListener("mousedown", (e) => {
		isDraggingSendMessageWindow = true;
		const rect = sendMessageWindow.getBoundingClientRect();
		sendMessageWindowOffsetX = e.clientX - rect.left;
		sendMessageWindowOffsetY = e.clientY - rect.top;

		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", onMouseUp);
	});

	function onMouseMove(e) {
		if (!isDraggingSendMessageWindow) return;
		sendMessageWindow.style.left = `${e.clientX - sendMessageWindowOffsetX}px`;
		sendMessageWindow.style.top = `${e.clientY - sendMessageWindowOffsetY}px`;
	}

	function onMouseUp() {
		isDraggingSendMessageWindow = false;
		document.removeEventListener("mousemove", onMouseMove);
		document.removeEventListener("mouseup", onMouseUp);
	}
}

// Optionally auto-init when DOM is ready
document.addEventListener("DOMContentLoaded", initSendMessageWindow);
