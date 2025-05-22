/**
 * notifications.js
 * Provides functions to show info and confirmation modals.
 */

const NOTIF_CONTAINER_ID = "notif-modal-container";

function ensureContainer() {
	let container = document.getElementById(NOTIF_CONTAINER_ID);
	if (!container) {
		container = document.createElement("div");
		container.id = NOTIF_CONTAINER_ID;
		container.style.position = "fixed";
		container.style.bottom = "20px";
		container.style.left = "20px";
		container.style.zIndex = "9999";
		container.style.display = "flex";
		container.style.flexDirection = "column";
		container.style.gap = "10px";
		document.body.appendChild(container);
	}
	return container;
}

export function showPopupNotification(title, body) {
	const container = ensureContainer();
	const modal = document.createElement("div");
	modal.style.background = "#222";
	modal.style.color = "#fff";
	modal.style.padding = "16px 24px";
	modal.style.borderRadius = "8px";
	modal.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
	modal.style.minWidth = "260px";
	modal.style.maxWidth = "340px";
	modal.style.pointerEvents = "auto";
	modal.style.transition = "opacity 0.2s";
	modal.style.opacity = "1";

	modal.innerHTML = `
        <div style="font-weight:bold; margin-bottom:8px;">${title}</div>
        <div>${body}</div>
    `;

	let timeout;
	let hovered = false;

	function removeModal() {
		modal.style.opacity = "0";
		setTimeout(() => {
			if (modal.parentNode) modal.parentNode.removeChild(modal);
		}, 200);
	}

	function startTimeout() {
		timeout = setTimeout(() => {
			if (!hovered) removeModal();
		}, 5000);
	}

	modal.addEventListener("mouseenter", () => {
		hovered = true;
		clearTimeout(timeout);
	});
	modal.addEventListener("mouseleave", () => {
		hovered = false;
		startTimeout();
	});

	container.appendChild(modal);
	startTimeout();
}

export function createConfirmModal(title, body, onConfirm) {
	const container = ensureContainer();
	const modal = document.createElement("div");
	modal.style.background = "#222";
	modal.style.color = "#fff";
	modal.style.padding = "16px 24px";
	//modal.style.borderRadius = "8px";
	modal.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
	modal.style.minWidth = "260px";
	modal.style.maxWidth = "340px";
	modal.style.pointerEvents = "auto";

	modal.innerHTML = `
        <div style="font-weight:bold; margin-bottom:8px;">${title}</div>
        <div>${body}</div>
        <div style="margin-top: 16px; display: flex; justify-content: space-between;">
            <button id="confirm-btn" style="background: #4B5320; color: #fff; border: none; padding: 8px 16px;">Confirm</button>
            <button id="cancel-btn" style="background:rgb(80, 80, 80); color: #fff; border: none; padding: 8px 16px;">Cancel</button>
        </div>
    `;

	const confirmBtn = modal.querySelector("#confirm-btn");
	const cancelBtn = modal.querySelector("#cancel-btn");

	confirmBtn.addEventListener("click", () => {
		onConfirm();
		container.removeChild(modal);
	});

	cancelBtn.addEventListener("click", () => {
		container.removeChild(modal);
	});

	container.appendChild(modal);
}
