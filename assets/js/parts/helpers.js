/**
 * Make and element draggable.
 * This function allows you to make an element draggable by clicking and dragging.
 *
 * @param {*} element
 * @param {function} callback - Optional callback function to be called when the mouse up on an element.
 */
export function makeDraggable(element, callback = null) {
	let pos1 = 0,
		pos2 = 0,
		pos3 = 0,
		pos4 = 0;

	const dragMouseDown = (e) => {
		pos3 = e.clientX;
		pos4 = e.clientY;
		document.onmouseup = closeDragElement;
		document.onmousemove = elementDrag;
	};

	const elementDrag = (e) => {
		pos1 = pos3 - e.clientX;
		pos2 = pos4 - e.clientY;
		pos3 = e.clientX;
		pos4 = e.clientY;
		element.style.top = element.offsetTop - pos2 + "px";
		element.style.left = element.offsetLeft - pos1 + "px";
	};

	const closeDragElement = () => {
		document.onmouseup = null;
		document.onmousemove = null;
	};

	const header = element.querySelector(".drag-selector");
	if (header) {
		header.onmousedown = dragMouseDown;
	} else {
		element.onmousedown = dragMouseDown;
	}
}
