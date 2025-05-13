let sendMessageWindowOffsetX, sendMessageWindowOffsetY;
let isDraggingSendMessageWindow = false;

function quickMessage(message) {
	const textarea = document.querySelector("#sendMessageWindow textarea");
	textarea.value = message;
}

$(document).ready(function () {
	// Make the window draggable
	const $sendMessageWindow = $("#sendMessageWindow");

	$sendMessageWindow.find("div").on("mousedown", function (e) {
		isDraggingSendMessageWindow = true;
		sendMessageWindowOffsetX = e.clientX - $sendMessageWindow.offset().left;
		sendMessageWindowOffsetY = e.clientY - $sendMessageWindow.offset().top;
		$(document).on("mousemove", onMouseMoveSendMessageWindow);
		$(document).on("mouseup", onMouseUpSendMessageWindow);
	});

	function onMouseMoveSendMessageWindow(e) {
		if (isDraggingSendMessageWindow) {
			$sendMessageWindow.css({
				left: `${e.clientX - sendMessageWindowOffsetX}px`,
				top: `${e.clientY - sendMessageWindowOffsetY}px`,
			});
		}
	}

	function onMouseUpSendMessageWindow() {
		isDraggingSendMessageWindow = false;
		$(document).off("mousemove", onMouseMoveSendMessageWindow);
		$(document).off("mouseup", onMouseUpSendMessageWindow);
	}
});
