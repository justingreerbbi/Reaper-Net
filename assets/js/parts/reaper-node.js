import { makeDraggable } from "./helpers.js";

// === Reaper Node State ===
let reaper_log = null;
let reaper_node_lines = [];
let reaper_nodes_found = [];

const NODE_LIST_EXPIRE_MINUTES = 10;
const LINE_HISTORY_EXPIRE_MINUTES = 30;

export let reaperNodeSocket = null;

/**
 * Initialize the Reaper Node Socket
 *
 * This function sets up the socket connection to the Reaper Node server.
 */
export function startReaperNodeSocket() {
	reaper_log = document.getElementById("reaper-log");
	reaperNodeSocket = io();

	reaperNodeSocket.on("reaper_node_received", (data) => {
		const now = new Date();
		const timestamp = now.toLocaleTimeString();
		reaper_log.textContent += `[${timestamp}] ${data.line}\n`;
		reaper_log.scrollTop = reaper_log.scrollHeight;

		const lineObj = {
			line: data.line,
			timestamp: now.toISOString(),
		};
		reaper_node_lines.push(lineObj);
		handleReaperResponse(data.line);
	});
}

export function sendCommandToReaperNode(command) {
	if (!command) {
		if (reaper_log) reaper_log.textContent += "No command entered.\n";
		return;
	}
	reaperNodeSocket.emit("send_reaper_node_command", { command });
	//console.log("Command sent:", command);
}

export function createReaperGroupMessageWindow() {
	const modalHtml = `
		<div class="modal fade" id="reaper-group-message-modal" tabindex="-1" aria-labelledby="reaper-group-message-modal-label" inert>
			<div class="modal-dialog modal-lg">
				<div class="modal-content">
					<div class="modal-header">
						<h5 class="modal-title" id="reaper-group-message-modal-label">Reaper Group Message</h5>
						<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
					</div>
					<div class="modal-body">
						<textarea id="reaper-group-message-textarea" rows="10" style="width: 100%;"></textarea>
					</div>
					<div class="modal-footer">
						<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
						<button type="button" class="btn btn-primary" id="send-reaper-group-message-btn">Send</button>
					</div>
				</div>
			</div>
		</div>
	`;

	document.body.insertAdjacentHTML("beforeend", modalHtml);
	const modal = new bootstrap.Modal(document.getElementById("reaper-group-message-modal"));
	const sendButton = document.getElementById("send-reaper-group-message-btn");

	sendButton.addEventListener("click", () => {
		const message = document.getElementById("reaper-group-message-textarea").value;
		if (message) {
			reaperNodeSocket.emit("send_reaper_node_command", { command: "AT+MSG=" + message });
			alert("Message sent to Reaper group.");
			document.getElementById("reaper-group-message-modal").remove();
			modal.hide();
		} else {
			alert("Please enter a message.");
		}
	});
	modal.show();
}

/**
 * Add a Reaper Node to the contact list
 * @param {*} deviceName
 */
function addReaperNodeToContactList(node) {
	//console.log("Adding Reaper Node to contact list:", node);
	let nodes = [];
	let telemetry = null;
	const nodesStored = localStorage.getItem("reaper_nodes_found");
	if (nodesStored) {
		nodes = JSON.parse(nodesStored);
	}
	const nodeIndex = nodes.findIndex((n) => n.device_name === node.device_name);
	const nowIso = new Date().toISOString();

	if (node.telemetry) {
		telemetry = {
			latitude: node.telemetry.latitude,
			longitude: node.telemetry.longitude,
			altitude: node.telemetry.altitude,
			speed: node.telemetry.speed,
			heading: node.telemetry.heading,
			satellites: node.telemetry.satellites,
		};
	}

	if (nodeIndex !== -1) {
		// Update existing node
		nodes[nodeIndex].last_seen = nowIso;
		if (telemetry) {
			nodes[nodeIndex].telemetry = telemetry;
		}
	} else {
		// Add new node
		nodes.push({
			device_name: node.device_name,
			found_at: nowIso,
			last_seen: nowIso,
			telemetry: telemetry,
		});
	}

	// Update the node list in local storage
	localStorage.setItem("reaper_nodes_found", JSON.stringify(nodes));
}

/**
 * Add a Message to the group message storage.
 * @param {*} m
 */
function addGroupMessageToStorage(m) {
	let groupMessages = [];
	const stored = localStorage.getItem("reaper_group_messages");
	if (stored) {
		groupMessages = JSON.parse(stored);
	}
	// Only add if msgId does not already exist
	if (!groupMessages.some((msg) => msg.msgId === m.msgId)) {
		groupMessages.push(m);
		localStorage.setItem("reaper_group_messages", JSON.stringify(groupMessages));
	}

	window.updateGroupMessagesContent();
}

/**
 * Add Direct Message to the storage.
 * @param {*} m
 */
function addDirectMessageToStorage(m) {
	let directMessages = [];
	const stored = localStorage.getItem("reaper_direct_messages");
	if (stored) {
		directMessages = JSON.parse(stored);
	}
	// Only add if msgId does not already exist
	if (!directMessages.some((msg) => msg.msgId === m.msgId)) {
		directMessages.push(m);
		localStorage.setItem("reaper_direct_messages", JSON.stringify(directMessages));
	}
	// @todo: Add the function to update the direct messages content.
	//window.updateDirectMessagesContent();
}

function handleReaperResponse(data) {
	if (typeof data !== "string") return;

	reaper_node_lines.push({
		line: data,
		timestamp: new Date().toISOString(),
	});
	localStorage.setItem("reaper_node_lines", JSON.stringify(reaper_node_lines));

	const parts = data.split("|");

	// Capture LOG Update
	if (parts[0] === "LOG") {
		const log_message = parts[1];
		const log_data_event = new CustomEvent("bus:log_update", {
			bubbles: false,
			cancelable: false,
			detail: log_message,
		});
		window.bus.dispatchEvent(log_data_event);
		return;
	}

	// Capture GPS Update
	if (parts[0] === "GPS") {
		// Example: GPS|37.774900,-122.419400,10.0,5.5,180.0,7
		const latitude = parseFloat(parts[1].split(",")[0]);
		const longitude = parseFloat(parts[1].split(",")[1]);
		const altitude = parseFloat(parts[1].split(",")[2]);
		const speed = parseFloat(parts[1].split(",")[3]);
		const heading = parseFloat(parts[1].split(",")[4]);
		const satellites = parseInt(parts[1].split(",")[5], 10);

		const gpsData = {
			latitude: latitude,
			longitude: longitude,
			altitude: altitude,
			speed: speed,
			heading: heading,
			satellites: satellites,
			timestamp: new Date().toISOString(),
		};

		const gps_update_event = new CustomEvent("bus:gps_update", {
			bubbles: false,
			cancelable: false,
			detail: gpsData,
		});
		window.bus.dispatchEvent(gps_update_event);

		// For the sake of sanity, let's store the last GPS location.
		localStorage.setItem("last_gps_data", JSON.stringify(gpsData));
		return;
	}

	if (parts[0] === "RECV") {
		if (parts[1] === "FRAG") {
			// Future fragment handling here
			return;
		}

		// Handle Group Message
		// Example: RECV|MSG|sender|message|msgId
		if (parts[1] === "MSG") {
			const deviceName = parts[2];
			const message = parts[3];
			const msgId = parts[4];

			const m = {
				device_name: deviceName,
				message: message,
				msgId: msgId,
				read: false,
				timestamp: new Date().toISOString(),
			};

			addReaperNodeToContactList(m);
			addGroupMessageToStorage(m);

			const received_message = new CustomEvent("bus:reaper_node_received_group_message", {
				bubbles: false,
				cancelable: false,
				detail: m,
			});
			window.bus.dispatchEvent(received_message);
		}

		// Handle Direct Message
		// Example: RECV|DMSG|sender|recipient|message|msgId
		if (parts[1] === "DMSG") {
			//console.log('Direct Message Received', parts);
			const deviceName = parts[2];
			const recipient = parts[3];
			const message = parts[4];
			const msgId = parts[5];

			const m = {
				device_name: deviceName,
				recipient: recipient,
				message: message,
				msgId: msgId,
				read: false,
				timestamp: new Date().toISOString(),
			};

			addReaperNodeToContactList(m);
			addDirectMessageToStorage(m);

			const received_direct_message = new CustomEvent("bus:reaper_node_received_direct_message", {
				bubbles: false,
				cancelable: false,
				detail: m,
			});
			window.bus.dispatchEvent(received_direct_message);
		}

		// Handle ACK_CONFIRM
		// Example: RECV|ACK_CONFIRM|msgId
		if (parts[1] === "ACK_CONFIRM") {
			const msgId = parts[2];
			console.log(`Message ${msgId} was received by a reaper node.`);
			return;
		}

		// Handle Beacon
		// Example: RECV|BEACON|deviceName|lat,lng,alt,speed,heading,sats|msgId
		if (parts[1] === "BEACON") {
			const deviceName = parts[2];
			const lat = parseFloat(parts[3].split(",")[0]);
			const lng = parseFloat(parts[3].split(",")[1]);
			const alt = parseFloat(parts[3].split(",")[2]);
			const speed = parseFloat(parts[3].split(",")[3]);
			const heading = parseFloat(parts[3].split(",")[4]);
			const sats = parseInt(parts[3].split(",")[5], 10);
			const msgId = parts[4];
			const now = new Date();

			const m = {
				device_name: deviceName,
				found_at: now.toISOString(),
				last_seen: now.toISOString(),
				telemetry: {
					latitude: lat,
					longitude: lng,
					altitude: alt,
					speed: speed,
					heading: heading,
					satellites: sats,
				},
			};

			addReaperNodeToContactList(m);
			updateReaperNodeContent();

			const beacon_event = new CustomEvent("bus:reaper_node_received_beacon_message", {
				bubbles: false,
				cancelable: false,
				detail: {
					device_name: deviceName,
					lat: lat,
					lng: lng,
					alt: alt,
					speed: speed,
					heading: heading,
					sats: sats,
					msgId: msgId,
				},
			});
			window.bus.dispatchEvent(beacon_event);
		}
	}
}

export function updateReaperNodeContent() {
	const stored = localStorage.getItem("reaper_nodes_found");
	if (stored) reaper_nodes_found = JSON.parse(stored);

	const nodeList = document.getElementById("node-list");
	const nodeListHeader = document.getElementById("node-list-header");

	if (!reaper_nodes_found.length) {
		if (nodeList) nodeList.innerHTML = "<li>No nodes found.</li>";
		if (nodeListHeader) nodeListHeader.textContent = "Nodes (0)";
		return;
	}

	const itemsHTML = reaper_nodes_found
		.map((node) => {
			const foundAt = new Date(node.found_at).toLocaleString();
			const lastSeen = new Date(node.last_seen);
			const now = new Date();
			const diffMin = Math.floor((now - lastSeen) / 60000);
			const lastCheckIn = diffMin < 1 ? "Just Now" : diffMin === 1 ? "1 min ago" : `${diffMin} Mins ago`;

			return `
			<li>
				<div class="node-list-item">
					<div class="node-name light-text">CALLSIGN: ${node.device_name.toUpperCase()}</div>
					<div class="node-list-item-sub">
						<div class="node-telemetry">${node.telemetry ? `${node.telemetry.latitude}, ${node.telemetry.longitude}` : "No GPS Data"}</div>
						<div class="first-seen"><strong>First Contact:</strong> <br/>${foundAt}</div>
						<div class="last-seen"><strong>Last Seen:</strong> <br/>${lastCheckIn}</div>
					</div>
					<button class="node-list-item-msg-btn" data-device-id="${node.device_name}">
						SEND MSG
					</button>
				</div>
			</li>
		`;
		})
		.join("");

	if (nodeList) nodeList.innerHTML = itemsHTML;
	if (nodeListHeader) nodeListHeader.textContent = `Nodes (${reaper_nodes_found.length})`;
}

export function cleanUpOldReaperLines() {
	const cutoff = new Date(Date.now() - LINE_HISTORY_EXPIRE_MINUTES * 60000);
	reaper_node_lines = reaper_node_lines.filter((line) => new Date(line.timestamp) >= cutoff);
	localStorage.setItem("reaper_node_lines", JSON.stringify(reaper_node_lines));
}

export function loadReaperNodeState() {
	const nodes = localStorage.getItem("reaper_nodes_found");
	const lines = localStorage.getItem("reaper_node_lines");

	reaper_nodes_found = nodes ? JSON.parse(nodes) : [];
	reaper_node_lines = lines ? JSON.parse(lines) : [];

	localStorage.setItem("reaper_nodes_found", JSON.stringify(reaper_nodes_found));
	localStorage.setItem("reaper_node_lines", JSON.stringify(reaper_node_lines));
}

/**
 * MESSENGER FUNCTIONS FOR COMMUNICATING
 */

/**
 * Open Group Chat Modal
 *
 * This simply opens a large modal with a list of group messages.
 * @todo: Add quick message sending.
 */
export function openGroupChatModal() {
	const groupMessages = JSON.parse(localStorage.getItem("reaper_group_messages") || "[]");
	const messagesHtml = groupMessages.length
		? groupMessages
			.map(
				(msg) => `
			<div class="group-message-item mb-3 p-2 border rounded">
				<div class="fw-bold">${msg.device_name || "Unknown"}</div>
				<div class="mb-1">${msg.message}</div>
				<div class="text-muted small">${new Date(msg.timestamp).toLocaleString()}</div>
			</div>
		`
			)
			.join("")
		: "<div class='text-center text-muted'>No messages yet.</div>";

	const quickReplies = ["Roger that.", "Copy.", "Need assistance.", "All clear.", "Moving to location."];

	const quickRepliesHtml = quickReplies.map((q) => `<button type="button" class="btn btn-outline-secondary btn-sm me-2 mb-2 quick-reply-btn">${q}</button>`).join("");

	const modalHtml = `
		<div class="modal fade" id="global-group-chat-modal" tabindex="-1" aria-labelledby="global-group-chat-modal-label">
			<div class="modal-dialog modal-lg">
				<div class="modal-content">
					<div class="modal-header drag-selector">
						<h5 class="modal-title" id="global-group-chat-modal-label">Global Messages</h5>
						<button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
					</div>
					<div class="modal-body" style="max-height: 400px; overflow-y: auto;">
						${messagesHtml}
					</div>
					<div class="modal-footer flex-column align-items-stretch">
						<textarea id="global-group-message-textarea" rows="3" class="form-control mb-2" placeholder="Type your message..."></textarea>
						<button type="button" class="btn btn-primary mb-2" id="global-group-message-send-btn">Send</button>
						<div class="d-flex flex-wrap">${quickRepliesHtml}</div>
					</div>
				</div>
			</div>
		</div>
	`;

	document.body.insertAdjacentHTML("beforeend", modalHtml);
	const modal = new bootstrap.Modal(document.getElementById("global-group-chat-modal"));
	makeDraggable(document.getElementById("global-group-chat-modal"), document.querySelector(".drag-selector"));
	modal.show();

	document.getElementById("global-group-message-send-btn").addEventListener("click", () => {
		const textarea = document.getElementById("global-group-message-textarea");
		const message = textarea.value.trim();
		if (message) {
			reaperNodeSocket.emit("send_reaper_node_command", { command: "AT+MSG=" + message });
			textarea.value = "";
			//modal.hide();
			//document.getElementById("global-group-chat-modal").remove();
		} else {
			alert("Please enter a message.");
		}
	});

	document.querySelectorAll(".quick-reply-btn").forEach((btn) => {
		btn.addEventListener("click", () => {
			const textarea = document.getElementById("global-group-message-textarea");
			textarea.value = btn.textContent;
			textarea.focus();
		});
	});

	window.updateGroupMessagesContent = function () {
		const groupMessages = JSON.parse(localStorage.getItem("reaper_group_messages") || "[]");
		const modalBody = document.querySelector("#global-group-chat-modal .modal-body");
		if (!modalBody) return;

		const messagesHtml = groupMessages.length
			? groupMessages
				.map(
					(msg) => `
				<div class="group-message-item mb-3 p-2 border rounded">
					<div class="fw-bold">${msg.device_name || "Unknown"}</div>
					<div class="mb-1">${msg.message}</div>
					<div class="text-muted small">${new Date(msg.timestamp).toLocaleString()}</div>
				</div>
			`
				)
				.join("")
			: "<div class='text-center text-muted'>No messages yet.</div>";

		modalBody.innerHTML = messagesHtml;
		modalBody.scrollTop = modalBody.scrollHeight;
	};

	// Listen for new group messages and update modal if open
	window.bus.addEventListener("bus:reaper_node_received_group_message", () => {
		if (document.getElementById("global-group-chat-modal")) {
			window.updateGroupMessagesContent();
		}
	});

	// Also update after sending a message
	document.getElementById("global-group-message-send-btn").addEventListener("click", () => {
		setTimeout(() => {
			if (document.getElementById("global-group-chat-modal")) {
				window.updateGroupMessagesContent();
			}
		}, 200);
	});
}
