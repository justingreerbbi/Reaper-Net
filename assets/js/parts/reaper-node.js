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
	console.log("Command sent:", command);
	document.getElementById("reaper-cmd-input").value = "";
}

export function createReaperGroupMessageWindow() {
	const modalHtml = `
		<div class="modal fade" id="reaper-group-message-modal" tabindex="-1" aria-labelledby="reaper-group-message-modal-label" aria-hidden="true">
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
function addReaperNodeToContactList(deviceName) {
	let nodes = [];
	const nodesStored = localStorage.getItem("reaper_nodes_found");
	if (nodesStored) {
		nodes = JSON.parse(nodesStored);
	}
	const nodeIndex = nodes.findIndex((n) => n.device_name === deviceName);
	const nowIso = new Date().toISOString();
	if (nodeIndex !== -1) {
		nodes[nodeIndex].last_seen = nowIso;
	} else {
		nodes.push({
			device_name: sender,
			found_at: nowIso,
			last_seen: nowIso,
			telemetry: null,
		});
	}
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
		localStorage.setItem("reaper_direct_messages", JSON.stringify(directMessagess));
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
		const [lat, lng, alt, speed, heading, sats] = parts[1].split(",").map(Number);

		const gpsData = {
			lat,
			lng,
			alt,
			speed,
			heading,
			satellites: sats,
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
			const sender = parts[2];
			const message = parts[3];
			const msgId = parts[4];

			const m = {
				sender,
				message,
				msgId,
				read: false,
				timestamp: new Date().toISOString(),
			};

			addReaperNodeToContactList(sender);
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
			const sender = parts[2];
			const recipient = parts[3];
			const message = parts[4];
			const msgId = parts[5];

			const m = {
				sender,
				recipient,
				message,
				msgId,
				read: false,
				timestamp: new Date().toISOString(),
			};

			addReaperNodeToContactList(sender);
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
		// Example: RECV|BEACON|deviceName|lat,lon,alt,speed,heading,sats|msgId
		if (parts[1] === "BEACON") {
			const deviceName = parts[2];
			const [lat, lon, alt, speed, heading, sats] = parts[3].substring(7).split(",").map(Number);
			const msgId = parts[4];
			const now = new Date();

			let node = reaper_nodes_found.find((n) => n.device_name === deviceName);
			if (!node) {
				node = {
					device_name: deviceName,
					found_at: now.toISOString(),
					last_seen: now.toISOString(),
					telemetry: { lat, lon, alt, speed, heading, sats },
				};
				reaper_nodes_found.push(node);
			} else {
				node.last_seen = now.toISOString();
			}

			localStorage.setItem("reaper_nodes_found", JSON.stringify(reaper_nodes_found));
			updateReaperNodeContent();

			const cutoff = new Date(now.getTime() - NODE_LIST_EXPIRE_MINUTES * 60000);
			reaper_nodes_found = reaper_nodes_found.filter((n) => new Date(n.last_seen) >= cutoff);
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
				<span class="node-list-callsign">
					CALLSIGN: ${node.device_name.toUpperCase()}<br>
					<span style="font-size: 12px; color: #aaa">
						First Contact: <br/>${foundAt}<br>
						Last Check In: ${lastCheckIn}
					</span>
				</span>
				<button class="node-list-item-msg-btn" data-device-id="${node.device_name}">
					SEND MSG
				</button>
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
