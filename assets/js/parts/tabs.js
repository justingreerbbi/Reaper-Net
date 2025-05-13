function showTabContent(tabId) {
	document.querySelectorAll(".tab-content").forEach((tab) => {
		tab.style.display = "none";
	});
	document.getElementById(tabId).style.display = "block";
}

// Show the first tab by default
showTabContent("tab1");
