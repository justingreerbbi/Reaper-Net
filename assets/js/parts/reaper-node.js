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

	reaperNodeSocket.on("serial_data", (data) => {
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

function handleReaperResponse(data) {
	if (typeof data !== "string") return;

	reaper_node_lines.push({
		line: data,
		timestamp: new Date().toISOString(),
	});
	localStorage.setItem("reaper_node_lines", JSON.stringify(reaper_node_lines));

	const parts = data.split("|");
	if (parts[0] === "RECV") {
		if (parts[1] === "FRAG") {
			// Future fragment handling here
			return;
		}

		if (parts[1] === "ACK_CONFIRM") {
			const msgId = parts[2];
			alert(`Message ${msgId} was received by a reaper node.`);
			return;
		}

		if (parts.length === 4 && parts[2].startsWith("BEACON:")) {
			const deviceName = parts[1];
			const [lat, lon, alt, speed, heading] = parts[2].substring(7).split(",").map(Number);
			const msgId = parts[3];
			const now = new Date();

			let node = reaper_nodes_found.find((n) => n.device_name === deviceName);
			if (!node) {
				node = {
					device_name: deviceName,
					found_at: now.toISOString(),
					last_seen: now.toISOString(),
					telemetry: { lat, lon, alt, speed, heading },
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
