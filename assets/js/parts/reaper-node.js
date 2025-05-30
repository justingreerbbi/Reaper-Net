import { decryptText, encryptText } from "./crypto.js";
import { makeDraggable } from "./helpers.js";

// === Reaper Node State ===
let reaper_log = null;
let reaper_node_lines = [];
let reaper_nodes_found = [];
let lastSendAttemptTimestamps = {};
let pendingMessageTimer = null;

export let reaperNodeSocket = null;
export let isSendingMessage = false;
export let sendingMessageMsgId = null;
export let secretKeys = {
	default: "Mw3KaqkQXG0lfqs5pFGNib2s7ixRqURCU5D6UMU5qp3uL8hnHumbSa6Iv5ic",
};

const NODE_LIST_EXPIRE_MINUTES = 10;
const LINE_HISTORY_EXPIRE_MINUTES = 30;

/**
 * Start socket connection
 */
export function initializeReaperNodeSocket() {
	reaper_log = document.getElementById("reaper-log");
	reaperNodeSocket = io();

	reaperNodeSocket.on("reaper_node_received", (data) => {
		const now = new Date();
		const timestamp = now.toLocaleTimeString();
		reaper_log.textContent += `[${timestamp}] ${data.line}\n`;
		reaper_log.scrollTop = reaper_log.scrollHeight;

		const lineObj = { line: data.line, timestamp: now.toISOString() };
		reaper_node_lines.push(lineObj);
		handleReaperResponse(data.line);
	});

	/**
	 * Add incoming frag message indicator to the bottom left of the screen
	 */
	if (!document.getElementById("frag-indicator")) {
		const fragIndicator = document.createElement("div");
		fragIndicator.id = "frag-indicator";
		fragIndicator.innerHTML = `
			<div id="frag-indicator-circle"></div>
		`;
		fragIndicator.style = `
			position: fixed;
			top: 15px;
			left: 15px;
			width: 50px;
			height: 26px;
			background: rgba(30,30,30,0.85);
			border-radius: 4px;
			display: flex;
			align-items: center;
			justify-content: center;
			z-index: 10001;
			box-shadow: 0 2px 8px rgba(0,0,0,0.2);
		`;
		const circle = fragIndicator.querySelector("#frag-indicator-circle");
		circle.style = `
			width: 15px;
			height: 15px;
			border-radius: 50%;
			background: #444;
			border: 2px solid #222;
			transition: background 0.2s;
		`;

		document.body.appendChild(fragIndicator);
	}

	let fragBlinkTimer = null;
	let fragBlinkCount = 0;

	function blinkFragIndicator() {
		const circle = document.getElementById("frag-indicator-circle");
		if (!circle) return;
		fragBlinkCount = 0;
		if (fragBlinkTimer) clearInterval(fragBlinkTimer);
		fragBlinkTimer = setInterval(() => {
			circle.style.background = fragBlinkCount % 2 === 0 ? "#198754" : "#444";
			fragBlinkCount++;
			if (fragBlinkCount >= 6) {
				// 3 blinks (500ms each)
				clearInterval(fragBlinkTimer);
				circle.style.background = "#444";
			}
		}, 500);
	}

	// Listen for incoming frag messages and trigger indicator
	window.bus.addEventListener("bus:reaper_node_incoming_frag", (data) => {
		blinkFragIndicator();
	});
}

/**
 * Send a global message and track it
 */
export function sendGlobalMessage(message) {
	if (isSendingMessage) {
		alert("Still sending previous message. Please wait.");
		return;
	}

	isSendingMessage = true;
	sendingMessageMsgId = null;

	const msgObj = {
		type: "sending",
		direction: "sent",
		device_name: "Me",
		message,
		msgId: null,
		read: true,
		timestamp: new Date().toISOString(),
		_temp: true,
	};

	addGroupMessageToStorage(msgObj);

	reaperNodeSocket.emit("send_reaper_node_command", { command: "AT+MSG=" + message });

	if (pendingMessageTimer) clearTimeout(pendingMessageTimer);
	pendingMessageTimer = setTimeout(() => {
		if (!sendingMessageMsgId) return;

		const stored = JSON.parse(localStorage.getItem("reaper_global_messages") || "[]");
		const idx = stored.findIndex((m) => m.msgId === sendingMessageMsgId);
		if (idx !== -1 && stored[idx].type === "sent") {
			stored[idx].type = "failed";
			localStorage.setItem("reaper_global_messages", JSON.stringify(stored));
			window.updateGroupMessagesContent?.();
		}
		isSendingMessage = false;
		sendingMessageMsgId = null;
	}, 8000);
}

/**
 * Send a direct message to a device (unchanged)
 */
export function sendDirectMessage(deviceName, message) {
	reaperNodeSocket.emit("send_reaper_node_command", { command: `AT+DMSG=${deviceName},${message}` });
}

/**
 * Manual command sender
 */
export function sendCommandToReaperNode(command) {
	if (!command) {
		if (reaper_log) reaper_log.textContent += "No command entered.\n";
		return;
	}
	reaperNodeSocket.emit("send_reaper_node_command", { command });
}

/**
 * Parse and handle all Reaper Node serial messages
 */
function handleReaperResponse(data) {
	if (typeof data !== "string") return;

	reaper_node_lines.push({ line: data, timestamp: new Date().toISOString() });
	localStorage.setItem("reaper_node_lines", JSON.stringify(reaper_node_lines));

	const parts = data.split("|");

	if (parts[0] == "GPS") {
		const gpsData = parts[1].split(",");
		const latitude = parseFloat(gpsData[0], 6);
		const longitude = parseFloat(gpsData[1], 6);
		const altitude = parseFloat(gpsData[2]);
		const speed = parseFloat(gpsData[3]);
		const heading = parseFloat(gpsData[4]);
		const satellites = parseInt(gpsData[5], 10);

		// Store latest GPS data globally
		window.last_gps_data = {
			latitude,
			longitude,
			altitude,
			speed,
			heading,
			satellites,
			timestamp: new Date().toISOString(),
		};

		localStorage.setItem("last_gps_data", JSON.stringify(window.last_gps_data));
		window.bus.dispatchEvent(new CustomEvent("bus:gps_update", { detail: window.last_gps_data }));

		return;
	}

	// === TRACK SEND ATTEMPT ===
	if (parts[0] === "SEND" && parts[1] === "ATTEMPT") {
		const msgId = parts[2];
		lastSendAttemptTimestamps[msgId] = Date.now();

		if (!sendingMessageMsgId) {
			sendingMessageMsgId = msgId;

			const messages = JSON.parse(localStorage.getItem("reaper_global_messages") || "[]");
			const idx = messages.findIndex((m) => m._temp === true);
			if (idx !== -1) {
				messages[idx].msgId = msgId;
				delete messages[idx]._temp;
				localStorage.setItem("reaper_global_messages", JSON.stringify(messages));
			}
		}
	}

	// === TRACK ACK_CONFIRM ===
	if (parts[0] === "RECV" && parts[1] === "ACK_CONFIRM") {
		const msgId = parts[2];
		if (msgId === sendingMessageMsgId) {
			isSendingMessage = false;
			sendingMessageMsgId = null;
			if (pendingMessageTimer) clearTimeout(pendingMessageTimer);
		}
	}

	// === HANDLE GROUP MSG ===
	if (parts[0] === "RECV" && parts[1] === "MSG") {
		var message = parts[3];
		const m = {
			type: "received",
			direction: "received",
			device_name: parts[2],
			message: message,
			msgId: parts[4],
			read: false,
			timestamp: new Date().toISOString(),
		};
		addReaperNodeToContactList(m);
		addGroupMessageToStorage(m);
		window.bus.dispatchEvent(new CustomEvent("bus:reaper_node_received_global_message", { detail: m }));
	}

	// === HANDLE RECV FRAG/INCOMING ===
	if (parts[0] === "RECV" && parts[1] === "FRAG") {
		window.bus.dispatchEvent(new CustomEvent("bus:reaper_node_incoming_frag", { detail: parts }));
	}

	// === HANDLE DIRECT MSG ===
	if (parts[0] === "RECV" && parts[1] === "DMSG") {
		message = parts[4];
		const m = {
			device_name: parts[2],
			recipient: parts[3],
			message: message,
			msgId: parts[5],
			read: false,
			timestamp: new Date().toISOString(),
		};
		addReaperNodeToContactList(m);
		addDirectMessageToStorage(m);
		window.bus.dispatchEvent(new CustomEvent("bus:reaper_node_received_direct_message", { detail: m }));
	}

	// === HANDLE NODE LOCATION ===
	if (parts[0] === "RECV" && parts[1] === "BEACON") {
		// Beacon Format: RECV|BEACON|DEVICE_NAME|LATITUDE,LONGITUDE,ALTITUDE,SPEED,HEADING,SATELLITES
		// Beacon Format: RECV|BEACON|DEVICE_NAME|LATITUDE,LONGITUDE,ALTITUDE,SPEED,HEADING,SATELLITES
		const deviceName = parts[2];
		const telemetryParts = (parts[3] || "").split(",");
		const [latitude, longitude, altitude, speed, heading, satellites] = telemetryParts.map((v, i) => (i < 2 ? parseFloat(v) : i === 5 ? parseInt(v, 10) : parseFloat(v)));

		const m = {
			device_name: deviceName,
			latitude,
			longitude,
			altitude,
			speed,
			heading,
			satellites,
			timestamp: new Date().toISOString(),
			telemetry: {
				latitude,
				longitude,
				altitude,
				speed,
				heading,
				satellites,
			},
		};
		addReaperNodeToContactList(m);
		window.bus.dispatchEvent(new CustomEvent("bus:reaper_node_received_beacon", { detail: m }));
	}

	// === HANDLE GENERIC ACK CONFIRM ===
	if (parts[0] === "ACK" && parts[1] === "CONFIRM") {
		const msgId = parts[2];
		if (msgId === sendingMessageMsgId) {
			isSendingMessage = false;
			sendingMessageMsgId = null;
			if (pendingMessageTimer) clearTimeout(pendingMessageTimer);

			const messages = JSON.parse(localStorage.getItem("reaper_global_messages") || "[]");
			const idx = messages.findIndex((m) => m.msgId === msgId);
			if (idx !== -1) {
				messages[idx].type = "received";
				localStorage.setItem("reaper_global_messages", JSON.stringify(messages));
				window.updateGroupMessagesContent?.();
			}
		}
	}
}

/**
 * Store group messages
 */
function addGroupMessageToStorage(m) {
	let messages = JSON.parse(localStorage.getItem("reaper_global_messages") || "[]");

	const idx = messages.findIndex((msg) => msg.msgId === m.msgId || msg._temp);
	if (idx !== -1) {
		messages[idx] = { ...messages[idx], ...m };
	} else {
		messages.push(m);
	}

	localStorage.setItem("reaper_global_messages", JSON.stringify(messages));
	window.updateGroupMessagesContent?.();
}

/**
 * Store direct messages
 */
function addDirectMessageToStorage(m) {
	let directMessages = JSON.parse(localStorage.getItem("reaper_direct_messages") || "[]");
	if (!directMessages.some((msg) => msg.msgId === m.msgId)) {
		directMessages.push(m);
		localStorage.setItem("reaper_direct_messages", JSON.stringify(directMessages));
	}
}

/**
 * Track node sightings
 */
function addReaperNodeToContactList(node) {
	let nodes = JSON.parse(localStorage.getItem("reaper_nodes_found") || "[]");
	const nowIso = new Date().toISOString();
	const nodeIndex = nodes.findIndex((n) => n.device_name === node.device_name);

	const telemetry = node.telemetry || {
		latitude: node.latitude,
		longitude: node.longitude,
		altitude: node.altitude,
		speed: node.speed,
		heading: node.heading,
		satellites: node.satellites,
	};

	if (nodeIndex !== -1) {
		nodes[nodeIndex].last_seen = nowIso;
		if (node.telemetry) {
			nodes[nodeIndex].telemetry = telemetry;
		}
	} else {
		nodes.push({
			device_name: node.device_name,
			found_at: nowIso,
			last_seen: nowIso,
			telemetry,
		});
	}

	localStorage.setItem("reaper_nodes_found", JSON.stringify(nodes));
	updateReaperNodeContent();
}

/**
 * Re-render Node List
 */
export function updateReaperNodeContent() {
	const stored = localStorage.getItem("reaper_nodes_found");
	if (stored) reaper_nodes_found = JSON.parse(stored);

	const nodeList = document.getElementById("node-list");
	const nodeListHeader = document.getElementById("node-list-header");

	if (!reaper_nodes_found.length) {
		nodeList.innerHTML = "<li>No nodes found.</li>";
		nodeListHeader.textContent = "Nodes (0)";
		return;
	}

	const itemsHTML = reaper_nodes_found
		.map((node) => {
			const foundAt = new Date(node.found_at).toLocaleString();
			const lastSeen = new Date(node.last_seen);
			const now = new Date();
			const diffMin = Math.floor((now - lastSeen) / 60000);
			const lastCheckIn = diffMin < 1 ? "Just Now" : `${diffMin} min${diffMin > 1 ? "s" : ""} ago`;
			const gpsData = node.telemetry ? `${node.telemetry.latitude}, ${node.telemetry.longitude}` : "No GPS";

			return `
		<li>
			<div class="node-list-item">
				<div class="node-name light-text">CALLSIGN: ${node.device_name.toUpperCase()}</div>
				<div class="node-list-item-sub">
					<div class="node-telemetry">${gpsData}</div>
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

	nodeList.innerHTML = itemsHTML;
	nodeListHeader.textContent = `Nodes (${reaper_nodes_found.length})`;
}

/**
 * Create and display the Global Chat UI
 */
export function openGlobalChatWindow() {
	if (document.getElementById("global-chat-window")) return;

	const chatBox = document.createElement("div");
	chatBox.id = "global-chat-window";
	chatBox.innerHTML = `
		<div id="global-chat-header">Global Chat <span id="global-chat-close" style="float:right;cursor:pointer;">&times;</span></div>
		<div id="global-chat-messages"></div>
		<div id="global-chat-input-area">
			<input type="text" id="global-chat-input" placeholder="Type a message..." />
			<button id="global-chat-send">Send</button>
		</div>
	`;

	chatBox.style = `
		position: fixed;
		bottom: 20px;
		right: 20px;
		width: 400px;
		height: 500px;
		background: rgba(0,0,0,0.85);
		border: 1px solid #333;
		border-radius: 8px;
		color: white;
		display: flex;
		flex-direction: column;
		font-family: monospace;
		z-index: 9999;
	`;

	chatBox.querySelector("#global-chat-header").style = `
		background: #1e1e1e;
		padding: 8px;
		cursor: move;
		font-weight: bold;
	`;

	chatBox.querySelector("#global-chat-messages").style = `
		flex: 1;
		padding: 10px;
		overflow-y: auto;
		margin-bottom: 20px;
	`;

	chatBox.querySelector("#global-chat-input-area").style = `
		display: flex;
		padding: 10px;
		border-top: 1px solid #444;
	`;

	chatBox.querySelector("#global-chat-input").style = `
		flex: 1;
		padding: 6px;
		margin-right: 5px;
		background: #222;
		color: white;
		border: 1px solid #444;
		border-radius: 4px;
	`;

	chatBox.querySelector("#global-chat-send").style = `
		background: #444;
		border: none;
		color: white;
		padding: 6px 12px;
		cursor: pointer;
		border-radius: 4px;
	`;

	document.body.appendChild(chatBox);
	makeDraggable(chatBox, chatBox.querySelector("#global-chat-header"));

	// Load messages
	updateGroupMessagesContent();

	/**
	 * SEND MESSAGE EVENT LISTENERS AND LOGIC
	 */
	const input = document.getElementById("global-chat-input");
	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			const msg = input.value.trim();
			if (msg) {
				sendGlobalMessage(msg);
				input.value = "";
			}
		}
	});
	document.getElementById("global-chat-send").addEventListener("click", () => {
		const input = document.getElementById("global-chat-input");
		const msg = input.value.trim();
		if (msg) {
			sendGlobalMessage(msg);
			input.value = "";
		}
	});

	// Close chat
	document.getElementById("global-chat-close").addEventListener("click", () => {
		chatBox.remove();
	});
}

/**
 * Render the global message list
 */
window.updateGroupMessagesContent = function () {
	const container = document.getElementById("global-chat-messages");
	if (!container) return;

	const messages = JSON.parse(localStorage.getItem("reaper_global_messages") || "[]");

	container.innerHTML = messages
		.map((msg) => {
			const time = new Date(msg.timestamp).toLocaleTimeString();
			const color = msg.type === "sent" ? "#00ff00" : msg.type === "failed" ? "#ff6666" : "#87ceeb";
			let statusText = "";
			if (msg.direction === "sent" && msg.type === "received") {
				statusText = "ACK Confirmed";
			} else if (msg.direction === "sent" && msg.type === "sending") {
				statusText = "Sending...";
			} else {
				statusText = msg.type === "sent" ? "Sent" : msg.type === "failed" ? "Failed" : "Received";
			}
			return `
	<div style="margin-bottom: 20px; display:">
		<div style="">
			<span style="color:${color};">${msg.device_name}</span>: 
			<span style="color:white;">${msg.message}</span>
		</div>
		<div style="color:#777; font-size: 0.8em; white-space: nowrap; margin-left: 8px; margin-top: 10px; text-align: right;">
			${time} - ${statusText}
		</div>
	</div>
`;
		})
		.join("");

	container.scrollTop = container.scrollHeight;
};

/**
 * Cleanup log memory
 */
export function cleanUpOldReaperLines() {
	const cutoff = new Date(Date.now() - LINE_HISTORY_EXPIRE_MINUTES * 60000);
	reaper_node_lines = reaper_node_lines.filter((line) => new Date(line.timestamp) >= cutoff);
	localStorage.setItem("reaper_node_lines", JSON.stringify(reaper_node_lines));
}

/**
 * Reload Node & Log State
 */
export function loadReaperNodeState() {
	const nodes = localStorage.getItem("reaper_nodes_found");
	const lines = localStorage.getItem("reaper_node_lines");
	reaper_nodes_found = nodes ? JSON.parse(nodes) : [];
	reaper_node_lines = lines ? JSON.parse(lines) : [];
}
