// Reaper Node Globals
const reaper_node_script_loaded = true; // Used to check if the script is loaded

let reaper_node_socket_loaded = false;
let reaper_node_socket = null;
let reaper_log = null;
let reaper_node_lines = [];
let reaper_nodes_found = [];

const minutes_since_last_beacon_removal = 2; // This should be a setting.

// Add event listener when the modal opens
$(document).on("shown.bs.modal", "#reaperConsoleModal", function () {
	$("#send-reaper-cmd-btn")
		.off("click")
		.on("click", function () {
			send_command_to_reaper();
		});
});

function send_command_to_reaper() {
	console.log("Send Command to Reaper");
	let command = $("#reaper-cmd-input").val();
	if (command === "") {
		reaper_log.textContent += "No command entered.\n";
		return;
	}
	reaper_node_socket.emit("send_command", { command });
	console.log("Command sent:", command);
	$("#reaper-cmd-imput").val("");
}

function start_reaper_node_socket() {
	reaper_log = document.getElementById("reaper-log");
	reaper_node_socket = io();
	reaper_node_socket.on("serial_data", (data) => {
		const now = new Date();
		const timestamp = now.toLocaleTimeString();
		reaper_log.textContent += `[${timestamp}] ${data.line}\n`;
		reaper_log.scrollTop = reaper_log.scrollHeight;
		const lineObj = {
			line: data.line,
			timestamp: now.toISOString(),
		};
		reaper_node_lines.push(lineObj);
		handle_reaper_response(data.line);
	});

	/**
	 * Handle the response from the Reaper Node
	 * @param {Object} data - The data received from the Reaper Node
	 */
	function handle_reaper_response(data) {
		if (typeof data !== "string") return;

		const parts = data.split("|");

		//console.log("Parts:", parts);

		if (parts[0] === "RECV") {
			if (parts[1] === "FRAG") {
				// TODO: Handle partial message fragments in the future
				// We could use this to find troublesome nodes that are sending but are having issues.
				//console.log("Fragment found, but not handled:", data);
				return;
			}

			// Message ACK_CONFIRM received
			if (parts[1] === "ACK_CONFIRM") {
				const msgId = parts[2];
				alert("Message " + msgId + " was received by a reaper node. Change Me to manage messages sent out.");
				return;
			}

			if (parts.length === 4 && parts[2] === "BEACON") {
				const deviceName = parts[1];
				const msgId = parts[3];
				const now = new Date();

				// Only add if not already present
				if (!reaper_nodes_found.some((node) => node.device_name === deviceName)) {
					reaper_nodes_found.push({ device_name: deviceName, found_at: now.toISOString(), last_seen: now.toISOString() });
				}

				// Update last_seen only for the node that sent the beacon
				const nodeToUpdate = reaper_nodes_found.find((node) => node.device_name === deviceName);
				if (nodeToUpdate) {
					nodeToUpdate.last_seen = now.toISOString();
				}

				// Remove nodes that have not been seen for minutes_since_last_beacon_removal
				const cutoffTime = new Date(now.getTime() - minutes_since_last_beacon_removal * 60000);
				reaper_nodes_found = reaper_nodes_found.filter((node) => new Date(node.last_seen) >= cutoffTime);

				// Every time we get a beacon, we need to update the node list
				// I am sure there is a better way to do this but this is just a rough draft.
				const nodeList = document.getElementById("node-list");
				if (nodeList) {
					// Render the updated node list
					nodeList.innerHTML = reaper_nodes_found
						.map((node) => {
							const callsign = node.device_name.toUpperCase();
							const foundAt = new Date(node.found_at).toLocaleString();
							const lastCheckIn = (() => {
								const now = new Date();
								const lastSeen = new Date(node.last_seen);
								const diffMs = now - lastSeen;
								const diffMin = Math.floor(diffMs / 60000);
								if (diffMin < 1) return "Just Now";
								if (diffMin === 1) return "1 min ago";
								return `${diffMin} Mins ago`;
							})();
							return `
                <li>
                    <span class="node-list-callsign">
                        CALLSIGN: ${callsign}<br>
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
				}

				const nodeListHeader = document.getElementById("node-list-header");
				if (nodeListHeader) {
					nodeListHeader.textContent = `Nodes (${reaper_nodes_found.length})`;
				}
			}
			//console.log("Found Nodes:", reaper_nodes_found);
			return;
		}
	}
}

$(document).ready(function () {});
