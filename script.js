const PASSWORD_UPDATE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_NOXzj_IQChM9QV90sgtyiL43YY9rwSwkQ3g21THcbsrqc5tfYBnCAWI0CCDL0-lb/exec";

(function () {
	"use strict";

	const STATE_FULL_NAMES = {
		AL: "Alabama",
		AK: "Alaska",
		AZ: "Arizona",
		AR: "Arkansas",
		CA: "California",
		CO: "Colorado",
		CT: "Connecticut",
		DE: "Delaware",
		FL: "Florida",
		GA: "Georgia",
		HI: "Hawaii",
		ID: "Idaho",
		IL: "Illinois",
		IN: "Indiana",
		IA: "Iowa",
		KS: "Kansas",
		KY: "Kentucky",
		LA: "Louisiana",
		ME: "Maine",
		MD: "Maryland",
		MA: "Massachusetts",
		MI: "Michigan",
		MN: "Minnesota",
		MS: "Mississippi",
		MO: "Missouri",
		MT: "Montana",
		NE: "Nebraska",
		NV: "Nevada",
		NH: "New Hampshire",
		NJ: "New Jersey",
		NM: "New Mexico",
		NY: "New York",
		NC: "North Carolina",
		ND: "North Dakota",
		OH: "Ohio",
		OK: "Oklahoma",
		OR: "Oregon",
		PA: "Pennsylvania",
		RI: "Rhode Island",
		SC: "South Carolina",
		SD: "South Dakota",
		TN: "Tennessee",
		TX: "Texas",
		UT: "Utah",
		VT: "Vermont",
		VA: "Virginia",
		WA: "Washington",
		WV: "West Virginia",
		WI: "Wisconsin",
		WY: "Wyoming",
		DC: "District of Columbia",
	};

	function formatMultilinePreview(text) {
		if (!text) return "";
		const escaped = text.replace(/[&<>]/g, function (m) {
			if (m === "&") return "&amp;";
			if (m === "<") return "&lt;";
			if (m === ">") return "&gt;";
			return m;
		});
		return escaped.replace(/\n/g, "<br>");
	}

	const CONFIG = {
		GOOGLE_SHEET_ID: "1IDsVjZrWCP0hXRn_EufLNgpOMtYFtV6jVZx9P5rvbcA",
		SHEET_NAME: "SERVER MANAGEMENT",
		CRED_SHEET_NAME: "CREDENTIALS",
		TEMPLATE_SHEET_NAME: "TROUBLESHOOTING TEMPLATES",
		PORTAL_COL: 0,
		SKU_COL: 1,
		STORE_NAME_COL: 2,
		ZIP_CODE_COL: 3,
		STATUS_COL: 10,
		NOTE1_COL: 15,
		NOTE2_COL: 16,
	};

	function getGoogleApiKey() {
		return localStorage.getItem("googleApiKey");
	}

	function setGoogleApiKeyAndLoad() {
		const newKey = prompt("Please enter your Google Sheets API key to load store data:\n(You can get it from Google Cloud Console)");
		if (newKey && newKey.trim() !== "") {
			localStorage.setItem("googleApiKey", newKey.trim());
			showNotification("API key saved. Loading stores...");
			loadSheetData();
		} else if (newKey === "") {
			localStorage.removeItem("googleApiKey");
			showNotification("API key removed.");
			storeData = [];
			clearSearchResults();
			["ticket", "store", "moolah"].forEach((prefix) => {
				const statusEl = document.getElementById(`${prefix}-loadStatus`);
				if (statusEl) statusEl.innerHTML = '<span class="error">⚠️ API key not set. Click SET SHEETS KEY in bulk bar.</span>';
			});
		}
	}

	const CLOCK_TIMES = {
		"6PM - 5AM": ["06:00 PM", "05:00 AM"],
		"9PM - 8AM": ["09:00 PM", "08:00 AM"],
		"7:30AM - 6:30PM": ["07:30 AM", "06:30 PM"],
	};

	const CONSTANT_ISSUE = `CREATE MOOLAH ACCOUNT - DONE ✅\nINSTALL & UPDATE ALL APPS - DONE ✅\nASSIGN STORE - DONE ✅`;

	const MODULE_OPTIONS = ["POS", "Portal", "Mobile App", "Cash Register", "Item Management", "Inventory", "Back Office", "Credit Card Terminal", "Printer", "Transactions", "Scan-Data", "Promotions", "Reports", "Register Setup", "Store Creation", "Rocket Application", "Moolah", "API", "Database import/export", "Gift Card", "Employee", "EDI", "Demo", "Training", "Credentials", "Other", "MIGRATION", "VERSION UPDATE", "EBT", "Cash drawer", "LABEL PRINTER", "BULK CHANGE", "CRASH - APK", "SERVER", "TOUCH SCREEN", "CHANGE STORE/EMAIL ID", "Customer Module", "Age Check", "Internet", "SYNC DATA", "Surcharge", "Image set", "Scanner", "TENDER", "TIME CARD", "BANK DEPOSITE", "E-Commerce", "Dual Price", "Lotto Guru", "Tax", "LABEL UTILITY", "FACTORY RESET", "DB EXPORT", "Adjustments", "NVR", "RECEIPT", "RETAILZGO", "INVOICE", "SOLINK INTEGRATION", "Price Level", "CashBack", "Customer Screen", "Active / Deactive", "Store", "OCR", "DEVICE ID"];
	const STATUS_OPTIONS = ["RESOLVED", "PENDING", "OTHER TASK", "UNSOLVED"];
	const SHIFT_OPTIONS = ["6PM - 5AM", "9PM - 8AM", "11PM - 10AM", "7:30AM - 6:30PM"];

	let currentActiveTab = "ticket";
	let allEntries = [];
	let storeData = [];
	let editId = null;
	let undoStack = [];
	let redoStack = [];

	const filteredResults = { moolah: [], store: [], ticket: [] };
	const selectedIndex = { moolah: -1, store: -1, ticket: -1 };

	let quillEditor = null;

	const collapseState = { months: {}, dates: {} };

	function loadCollapseState() {
		const saved = localStorage.getItem("sidebarCollapseState");
		if (saved) {
			try {
				const parsed = JSON.parse(saved);
				collapseState.months = parsed.months || {};
				collapseState.dates = parsed.dates || {};
			} catch (e) {}
		}
	}

	function saveCollapseState() {
		localStorage.setItem(
			"sidebarCollapseState",
			JSON.stringify({
				months: collapseState.months,
				dates: collapseState.dates,
			}),
		);
	}

	window.toggleMonth = function (monthKey) {
		collapseState.months[monthKey] = !collapseState.months[monthKey];
		saveCollapseState();
		renderSidebar();
	};

	window.toggleDate = function (dateKey) {
		collapseState.dates[dateKey] = !collapseState.dates[dateKey];
		saveCollapseState();
		renderSidebar();
	};

	function getESTDateString() {
		const now = new Date();
		const estDate = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
		return estDate.toISOString().slice(0, 10);
	}

	function isTodayEST(dateStr) {
		if (!dateStr) return false;
		const todayEST = getESTDateString();
		const parts = dateStr.split("/");
		if (parts.length !== 3) return false;
		const month = parts[0].padStart(2, "0");
		const day = parts[1].padStart(2, "0");
		const year = parts[2];
		const entryFormatted = `${year}-${month}-${day}`;
		return entryFormatted === todayEST;
	}

	function parseDateFromString(dateStr) {
		const parts = dateStr.split("/");
		if (parts.length !== 3) return null;
		const month = parseInt(parts[0], 10);
		const day = parseInt(parts[1], 10);
		const year = parseInt(parts[2], 10);
		return new Date(year, month - 1, day);
	}

	function showNotification(message) {
		const notification = document.getElementById("notification");
		notification.textContent = message;
		notification.classList.add("show");
		setTimeout(() => notification.classList.remove("show"), 2000);
	}

	function autoGrow(textarea) {
		textarea.style.height = "auto";
		textarea.style.height = textarea.scrollHeight + "px";
		syncPreviewHeight();
	}

	function escapeCSV(text) {
		if (text.includes("\n") || text.includes('"')) {
			text = text.replace(/"/g, '""');
			return `"${text}"`;
		}
		return text;
	}

	function escapeHtml(text) {
		if (!text) return "";
		return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
	}

	const ZIP_TO_STATE = [
		{ min: 35000, max: 36999, state: "AL" },
		{ min: 99500, max: 99999, state: "AK" },
		{ min: 85000, max: 86999, state: "AZ" },
		{ min: 71600, max: 72999, state: "AR" },
		{ min: 90000, max: 96699, state: "CA" },
		{ min: 80000, max: 81699, state: "CO" },
		{ min: 6000, max: 6999, state: "CT" },
		{ min: 19700, max: 19999, state: "DE" },
		{ min: 32000, max: 34999, state: "FL" },
		{ min: 30000, max: 31999, state: "GA" },
		{ min: 96700, max: 96999, state: "HI" },
		{ min: 83200, max: 83999, state: "ID" },
		{ min: 60000, max: 62999, state: "IL" },
		{ min: 46000, max: 47999, state: "IN" },
		{ min: 50000, max: 52999, state: "IA" },
		{ min: 66000, max: 67999, state: "KS" },
		{ min: 40000, max: 42999, state: "KY" },
		{ min: 70000, max: 71599, state: "LA" },
		{ min: 3900, max: 4999, state: "MA" },
		{ min: 20600, max: 21999, state: "MD" },
		{ min: 1000, max: 2799, state: "ME" },
		{ min: 48000, max: 49999, state: "MI" },
		{ min: 55000, max: 56799, state: "MN" },
		{ min: 38600, max: 39999, state: "MS" },
		{ min: 63000, max: 65999, state: "MO" },
		{ min: 59000, max: 59999, state: "MT" },
		{ min: 27000, max: 28999, state: "NC" },
		{ min: 58000, max: 58999, state: "ND" },
		{ min: 68000, max: 69999, state: "NE" },
		{ min: 88900, max: 89999, state: "NV" },
		{ min: 3000, max: 3899, state: "NH" },
		{ min: 7000, max: 8999, state: "NJ" },
		{ min: 87000, max: 88499, state: "NM" },
		{ min: 10000, max: 14999, state: "NY" },
		{ min: 43000, max: 45999, state: "OH" },
		{ min: 73000, max: 74999, state: "OK" },
		{ min: 97000, max: 97999, state: "OR" },
		{ min: 15000, max: 19699, state: "PA" },
		{ min: 2800, max: 2999, state: "RI" },
		{ min: 29000, max: 29999, state: "SC" },
		{ min: 57000, max: 57999, state: "SD" },
		{ min: 37000, max: 38599, state: "TN" },
		{ min: 73300, max: 73399, state: "TX" },
		{ min: 75000, max: 79999, state: "TX" },
		{ min: 88500, max: 88599, state: "TX" },
		{ min: 84000, max: 84999, state: "UT" },
		{ min: 5000, max: 5999, state: "VT" },
		{ min: 22000, max: 24699, state: "VA" },
		{ min: 98000, max: 99499, state: "WA" },
		{ min: 24700, max: 26999, state: "WV" },
		{ min: 53000, max: 54999, state: "WI" },
		{ min: 82000, max: 83199, state: "WY" },
		{ min: 20000, max: 20599, state: "DC" },
	];

	function getStateFromZip(zip) {
		const zipStr = String(zip).trim();

		if (!/^\d{5}$/.test(zipStr)) return "";

		const z = parseInt(zipStr, 10);

		const match = ZIP_TO_STATE.find((item) => z >= item.min && z <= item.max);

		return match ? match.state : "";
	}

	const EASTERN = new Set(["CT", "DE", "GA", "ME", "MD", "MA", "NH", "NJ", "NY", "NC", "OH", "PA", "RI", "SC", "VT", "VA", "WV", "DC"]);

	const CENTRAL = new Set(["AL", "AR", "IL", "IA", "LA", "MN", "MS", "MO", "OK", "WI"]);

	const MOUNTAIN = new Set(["AZ", "CO", "MT", "NM", "UT", "WY"]);

	const PACIFIC = new Set(["CA", "NV", "WA"]);

	const ALASKA = new Set(["AK"]);
	const HAWAII = new Set(["HI"]);

	function getTimezone(state, z) {
		if (state === "FL") return z >= 32400 && z <= 32599 ? "CT" : "ET";

		if (state === "IN") return (z >= 46300 && z <= 46499) || (z >= 47000 && z <= 47799) ? "CT" : "ET";

		if (state === "KY") return z >= 42000 && z <= 42799 ? "CT" : "ET";

		if (state === "TN") return z >= 37600 && z <= 37999 ? "ET" : "CT";

		if (state === "MI") return z >= 49800 && z <= 49999 ? "CT" : "ET";

		if (state === "TX") return z >= 79800 && z <= 79999 ? "MT" : "CT";

		if (state === "KS") return z >= 67700 && z <= 67799 ? "MT" : "CT";

		if (state === "NE") return z >= 69300 && z <= 69399 ? "MT" : "CT";

		if (state === "SD") return z >= 57700 && z <= 57799 ? "MT" : "CT";

		if (state === "ND") return z >= 58600 && z <= 58699 ? "MT" : "CT";

		if (state === "ID") return z >= 83500 ? "PT" : "MT";

		if (state === "OR") return z >= 97900 && z <= 97999 ? "MT" : "PT";

		if (EASTERN.has(state)) return "ET";
		if (CENTRAL.has(state)) return "CT";
		if (MOUNTAIN.has(state)) return "MT";
		if (PACIFIC.has(state)) return "PT";
		if (ALASKA.has(state)) return "AK";
		if (HAWAII.has(state)) return "HI";

		return "ET";
	}

	function getTimeZoneFromZip(zip) {
		const zipStr = String(zip).trim();

		if (!/^\d{5}$/.test(zipStr)) return "";

		const z = parseInt(zipStr, 10);

		const state = getStateFromZip(zipStr);

		if (!state) return "";

		return getTimezone(state, z);
	}

	function fetchCityFromZip(zip, prefix) {
		if (!/^\d{5}$/.test(String(zip).trim())) return;
		try {
			fetch(`https://api.zippopotam.us/us/${zip}`)
				.then((res) => {
					if (!res.ok) throw new Error("no-data");
					return res.json();
				})
				.then((data) => {
					const place = data.places && data.places[0] ? data.places[0]["place name"] : "";
					if (place) {
						const cityEl = document.getElementById(`${prefix}-city`);
						if (cityEl && (!cityEl.value || cityEl.value.trim() === "")) cityEl.value = place;
						const preview = document.getElementById(`${prefix}-preview-city`);
						if (preview) preview.textContent = place;
					}
				})
				.catch(() => {});
		} catch (e) {}
	}

	function getTimeZoneLabel(tzCode) {
		switch ((tzCode || "").toUpperCase()) {
			case "ET":
				return "Eastern Time (ET)";

			case "CT":
				return "Central Time (CT)";

			case "MT":
				return "Mountain Time (MT)";

			case "PT":
				return "Pacific Time (PT)";

			case "AK":
				return "Alaska Time (AK)";

			case "HI":
				return "Hawaii-Aleutian Time (HI)";

			default:
				return "";
		}
	}

	function storeGetFormattedDateMinusOne() {
		const d = new Date();
		d.setDate(d.getDate() - 1);
		const mm = String(d.getMonth() + 1).padStart(2, "0");
		const dd = String(d.getDate()).padStart(2, "0");
		const yyyy = d.getFullYear();
		return `${mm}/${dd}/${yyyy}`;
	}

	function toSentenceCase(text) {
		if (!text) return "";
		const lines = text.split(/\r?\n/);
		const processedLines = lines.map((line) => {
			if (line.trim() === "") return line;
			let lowerLine = line.toLowerCase();
			lowerLine = lowerLine.charAt(0).toUpperCase() + lowerLine.slice(1);
			if (lowerLine.startsWith("•")) {
				if (lowerLine.length > 2 && lowerLine[2] === " ") {
					lowerLine = lowerLine.substring(0, 3) + lowerLine[3].toUpperCase() + lowerLine.substring(4);
				}
			}
			return lowerLine;
		});
		return processedLines.join("\n");
	}

	function cloneEntries(entries) {
		return JSON.parse(JSON.stringify(entries));
	}

	function pushUndo() {
		undoStack.push(cloneEntries(allEntries));
		redoStack = [];
	}

	function undo() {
		if (undoStack.length === 0) {
			showNotification("Nothing to undo");
			return;
		}
		const previous = undoStack.pop();
		redoStack.push(cloneEntries(allEntries));
		allEntries = previous;
		saveAllEntries();
		renderTable();
		renderSidebar();
		showNotification("Undo successful");
	}

	function redo() {
		if (redoStack.length === 0) {
			showNotification("Nothing to redo");
			return;
		}
		const next = redoStack.pop();
		undoStack.push(cloneEntries(allEntries));
		allEntries = next;
		saveAllEntries();
		renderTable();
		renderSidebar();
		showNotification("Redo successful");
	}

	function syncPreviewHeight() {
		const leftPanel = document.querySelector(`#tab-${currentActiveTab} .left-panel`);
		const rightPanel = document.querySelector(`#tab-${currentActiveTab} .right-panel`);
		if (!leftPanel || !rightPanel) return;
		const leftHeight = leftPanel.offsetHeight;
		rightPanel.style.maxHeight = leftHeight + "px";
		rightPanel.style.overflowY = "auto";
	}

	function switchTab(tabName, button) {
		currentActiveTab = tabName;
		localStorage.setItem("activeTab", tabName);
		document.querySelectorAll(".tab-button").forEach((btn) => btn.classList.remove("active"));
		button.classList.add("active");
		document.querySelectorAll(".tab-content").forEach((content) => content.classList.remove("active"));
		document.getElementById(`tab-${tabName}`).classList.add("active");
		setTimeout(() => {
			document.querySelectorAll(`#tab-${tabName} textarea`).forEach((textarea) => autoGrow(textarea));
			syncPreviewHeight();
		}, 100);
	}

	function clock(type, prefix) {
		const shift = document.getElementById(`${prefix}-shift`).value;
		if (!shift) {
			showNotification("Set SHIFT");
			return;
		}
		if (!CLOCK_TIMES[shift]) {
			showNotification("Invalid SHIFT");
			return;
		}
		const now = new Date();
		const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
		const dateStr = now.toLocaleDateString("en-US");
		const dayName = days[now.getDay()];
		const timeStr = CLOCK_TIMES[shift][type === "IN" ? 0 : 1];
		const output = `${dateStr} - ${dayName} Shift\nClock ${type} - ${timeStr}`;
		navigator.clipboard.writeText(output).then(() => showNotification(`Clock ${type} copied!`));
	}

	async function loadSheetData() {
		const statusEls = {
			moolah: document.getElementById("moolah-loadStatus"),
			store: document.getElementById("store-loadStatus"),
			ticket: document.getElementById("ticket-loadStatus"),
		};

		const apiKey = getGoogleApiKey();
		if (!apiKey) {
			const msg = "⚠️ API key not set. Click SET SHEETS KEY in bulk bar.";
			Object.values(statusEls).forEach((el) => {
				if (el) el.innerHTML = `<span class="error">${msg}</span>`;
			});
			return;
		}

		Object.values(statusEls).forEach((el) => {
			if (el) el.innerHTML = '<div class="spinner"></div> Loading stores from Google Sheets...';
		});

		try {
			const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.GOOGLE_SHEET_ID}/values/${encodeURIComponent(CONFIG.SHEET_NAME)}?key=${apiKey}`;
			const response = await fetch(url);
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			const data = await response.json();
			if (!data.values || data.values.length === 0) throw new Error("No data found in sheet");

			storeData = [];
			for (let i = 1; i < data.values.length; i++) {
				const row = data.values[i];
				const portal = (row[CONFIG.PORTAL_COL] || "").toString().trim();
				const sku = (row[CONFIG.SKU_COL] || "").toString().trim();
				const storeName = (row[CONFIG.STORE_NAME_COL] || "").toString().trim();
				const zipCode = (row[CONFIG.ZIP_CODE_COL] || "").toString().trim();
				let status = (row[CONFIG.STATUS_COL] || "").toString().trim().toUpperCase();

				const note1 = (row[CONFIG.NOTE1_COL] || "").toString().trim().toUpperCase();
				const note2 = (row[CONFIG.NOTE2_COL] || "").toString().trim().toUpperCase();
				const combinedNotes = [note1, note2].filter((n) => n !== "").join(" ");

				if (!portal && !storeName) continue;
				if (!status) status = "UNKNOWN";

				storeData.push({
					portal: portal || "N/A",
					sku: sku,
					storeName: storeName.toUpperCase() || "UNKNOWN STORE",
					zipCode: zipCode || "N/A",
					status,
					notes: combinedNotes,
				});
			}
			storeData.sort((a, b) => a.storeName.localeCompare(b.storeName));

			Object.values(statusEls).forEach((el) => {
				if (el) el.innerHTML = `<span class="success">✅ Loaded ${storeData.length} stores successfully!</span>`;
			});
			clearSearchResults();
			showNotification(`Loaded ${storeData.length} stores`);
		} catch (error) {
			Object.values(statusEls).forEach((el) => {
				if (el) el.innerHTML = `<span class="error">❌ Error: ${error.message}</span>`;
			});
			storeData = [];
		}
		syncPreviewHeight();
	}

	function updateStatusCounters() {
		const tbody = document.querySelector("#entryTable tbody");
		if (!tbody) return;

		const rows = tbody.querySelectorAll("tr");
		let resolved = 0,
			pending = 0,
			other = 0;

		rows.forEach((row) => {
			const firstCell = row.querySelector("td");
			if (firstCell && firstCell.colSpan > 1) return;

			const statusCell = row.cells[12];
			if (!statusCell) return;

			const status = statusCell.textContent.trim().toUpperCase();
			if (status === "RESOLVED") resolved++;
			else if (status === "PENDING") pending++;
			else if (status === "OTHER TASK") other++;
		});

		const resolvedSpan = document.getElementById("counterResolved");
		const pendingSpan = document.getElementById("counterPending");
		const otherSpan = document.getElementById("counterOther");
		if (resolvedSpan) resolvedSpan.innerText = resolved;
		if (pendingSpan) pendingSpan.innerText = pending;
		if (otherSpan) otherSpan.innerText = other;
	}

	function clearSearchResults() {
		["ticket", "store", "moolah"].forEach((prefix) => {
			document.getElementById(`${prefix}-storeSearch`).value = "";
			document.getElementById(`${prefix}-searchResults`).innerHTML = '<div style="padding:20px; text-align:center; color:#64748b;">Type to search for stores...</div>';
		});
		filteredResults.moolah = [];
		filteredResults.store = [];
		filteredResults.ticket = [];
		selectedIndex.moolah = -1;
		selectedIndex.store = -1;
		selectedIndex.ticket = -1;
		syncPreviewHeight();
	}

	function getStatusClass(status) {
		const s = status.toUpperCase();
		if (s.includes("DEACTIVE")) return "status-deactive";
		if (s.includes("DELETED")) return "status-deleted";
		if (s.includes("ACTIVE")) return "status-active";
		return "status-demo";
	}

	function performSearch(prefix) {
		const searchTerm = document.getElementById(`${prefix}-storeSearch`).value.toUpperCase().trim();
		const resultsContainer = document.getElementById(`${prefix}-searchResults`);

		if (!storeData || storeData.length === 0) {
			resultsContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#64748b;">No store data loaded. Click SET SHEETS KEY to load.</div>';
			syncPreviewHeight();
			return;
		}
		if (!searchTerm) {
			resultsContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#64748b;">Type to search for stores...</div>';
			filteredResults[prefix] = [];
			syncPreviewHeight();
			return;
		}

		filteredResults[prefix] = storeData.filter((store) => store.storeName.includes(searchTerm) || store.zipCode.includes(searchTerm) || (store.notes && store.notes.includes(searchTerm))).slice(0, 100);

		if (filteredResults[prefix].length === 0) {
			resultsContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#64748b;">No stores found</div>';
			syncPreviewHeight();
			return;
		}

		let html = "";
		filteredResults[prefix].forEach((store, index) => {
			const statusClass = getStatusClass(store.status);
			html += `
                        <div class="result-item" onclick="selectStore('${prefix}', ${index})" onmouseenter="highlightResult('${prefix}', ${index})">
                            <div class="result-info">
                                <div class="result-store">
                                    ${store.storeName || "?"}
                                    <span class="status-badge ${statusClass}">${store.status}</span>
                                </div>
                                <div class="result-details">
                                    <span>📌 PORTAL ${store.portal || "N/A"}</span>
                                    <span class="result-zip">📍 ${store.zipCode || "N/A"}</span>
                                </div>
                            </div>
                        </div>
                    `;
		});
		resultsContainer.innerHTML = html;
		syncPreviewHeight();
	}

	function selectStore(prefix, index) {
		if (!filteredResults[prefix].length || index >= filteredResults[prefix].length) return;
		const store = filteredResults[prefix][index];

		if (prefix === "moolah") {
			document.getElementById("moolah-portal").value = store.portal;
			document.getElementById("moolah-storeName").value = store.storeName;
			document.getElementById("moolah-zipcode").value = store.zipCode;
			document.getElementById("moolah-sku").value = store.sku || "";
			moolahUpdatePreview();
			saveFormData("moolah");
		} else if (prefix === "store") {
			document.getElementById("store-portal").value = store.portal;
			document.getElementById("store-storeName").value = store.storeName;
			document.getElementById("store-zipcode").value = store.zipCode;
			document.getElementById("store-sku").value = store.sku || "";
			storeUpdatePreview();
			saveFormData("store");
		} else if (prefix === "ticket") {
			document.getElementById("ticket-portal").value = store.portal;
			document.getElementById("ticket-store").value = store.storeName;
			document.getElementById("ticket-zip").value = store.zipCode;
			ticketUpdatePreview();
			saveFormData("ticket");
		}

		document.getElementById(`${prefix}-storeSearch`).value = "";
		document.getElementById(`${prefix}-searchResults`).innerHTML = '<div style="padding:20px; text-align:center; color:#64748b;">Type to search for stores...</div>';
		filteredResults[prefix] = [];
		selectedIndex[prefix] = -1;

		showNotification(`Selected: ${store.storeName}`);
		syncPreviewHeight();
	}

	function highlightResult(prefix, index) {
		const items = document.querySelectorAll(`#${prefix}-searchResults .result-item`);
		items.forEach((item, i) => {
			if (i === index) item.classList.add("selected");
			else item.classList.remove("selected");
		});
	}

	function setupSearchKeyboard(prefix) {
		const searchInput = document.getElementById(`${prefix}-storeSearch`);

		searchInput.addEventListener("keydown", (e) => {
			const items = document.querySelectorAll(`#${prefix}-searchResults .result-item`);
			if (!items.length) return;

			if (e.key === "ArrowDown") {
				e.preventDefault();
				selectedIndex[prefix] = Math.min(selectedIndex[prefix] + 1, items.length - 1);
				updateSelection(prefix, items, selectedIndex[prefix]);
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				selectedIndex[prefix] = Math.max(selectedIndex[prefix] - 1, 0);
				updateSelection(prefix, items, selectedIndex[prefix]);
			} else if (e.key === "Enter" && selectedIndex[prefix] >= 0) {
				e.preventDefault();
				selectStore(prefix, selectedIndex[prefix]);
			}
		});

		function updateSelection(prefix, items, index) {
			items.forEach((item, i) => {
				if (i === index) {
					item.classList.add("selected");
					item.scrollIntoView({ block: "nearest", behavior: "smooth" });
				} else {
					item.classList.remove("selected");
				}
			});
		}

		searchInput.addEventListener("input", () => {
			selectedIndex[prefix] = -1;
			performSearch(prefix);
		});
	}

	function saveFormData(prefix) {
		const fields = {
			moolah: ["shift", "support", "portal", "storeName", "zipcode", "email", "password", "noOfTabs", "sku", "mokiId", "anydeskId"],
			store: ["shift", "support", "portal", "storeName", "zipcode", "agent", "email", "password", "sku", "database", "noOfReg", "mokiId", "anydeskId"],
			ticket: ["shift", "support", "portal", "store", "zip", "contactPerson", "contactNumber", "module", "issue", "escalated", "status", "remarks", "resolution", "note"],
		};
		const formData = {};
		fields[prefix].forEach((id) => {
			const el = document.getElementById(`${prefix}-${id}`);
			if (el) formData[id] = el.value;
		});
		localStorage.setItem(`${prefix}FormData`, JSON.stringify(formData));
	}

	function loadFormData(prefix) {
		const saved = localStorage.getItem(`${prefix}FormData`);
		if (saved) {
			try {
				const formData = JSON.parse(saved);
				Object.keys(formData).forEach((id) => {
					const el = document.getElementById(`${prefix}-${id}`);
					if (el && formData[id] !== undefined) {
						el.value = formData[id];
						if (el.tagName === "TEXTAREA") autoGrow(el);
					}
				});
			} catch (e) {}
		}
		if (prefix === "moolah") moolahUpdatePreview();
		if (prefix === "store") storeUpdatePreview();
		if (prefix === "ticket") ticketUpdatePreview();
	}

	function syncShiftSupportFromTicket() {
		const ticketShift = document.getElementById("ticket-shift").value;
		const ticketSupport = document.getElementById("ticket-support").value;
		const ticketDate = document.getElementById("ticket-date").value;

		document.getElementById("store-shift").value = ticketShift;
		document.getElementById("store-support").value = ticketSupport;
		document.getElementById("store-date").value = ticketDate;

		document.getElementById("moolah-shift").value = ticketShift;
		document.getElementById("moolah-support").value = ticketSupport;
		document.getElementById("moolah-date").value = ticketDate;

		storeUpdatePreview();
		moolahUpdatePreview();
		saveFormData("store");
		saveFormData("moolah");
	}

	function uppercaseTextNodes(element) {
		Array.from(element.childNodes).forEach((node) => {
			if (node.nodeType === Node.TEXT_NODE) {
				node.textContent = node.textContent.toUpperCase();
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				uppercaseTextNodes(node);
			}
		});
	}

	function uppercaseHtmlPreserveTags(html) {
		if (!html) return "";
		const temp = document.createElement("div");
		temp.innerHTML = html;
		uppercaseTextNodes(temp);
		return temp.innerHTML;
	}

	function moolahUpdatePreview() {
		const portal = document.getElementById("moolah-portal").value.trim();
		const storeName = document.getElementById("moolah-storeName").value.trim();
		const zipcode = document.getElementById("moolah-zipcode").value.trim();
		const address1 = document.getElementById("moolah-address1").value.trim();
		const address2 = document.getElementById("moolah-address2").value.trim();
		const city = document.getElementById("moolah-city").value.trim();
		const email = document.getElementById("moolah-email").value.trim();
		const password = document.getElementById("moolah-password").value.trim();
		const sku = document.getElementById("moolah-sku").value.trim();
		const noOfTabs = document.getElementById("moolah-noOfTabs").value.trim();
		const mokiId = document.getElementById("moolah-mokiId").value.trim();
		const anydeskId = document.getElementById("moolah-anydeskId").value.trim();

		const state = getStateFromZip(zipcode || "00000");
		const tzCode = zipcode ? getTimeZoneFromZip(zipcode) : "";
		const tzLabel = tzCode ? getTimeZoneLabel(tzCode) : "";
		const storeClean = storeName || "[STORENAME]";
		const portalClean = portal || "[PORTAL]";
		const zipClean = zipcode || "[ZIPCODE]";
		const skuClean = sku || "[SKU]";
		const statePart = state || "[STATE]";

		document.getElementById("moolah-preview-date").textContent = storeGetFormattedDateMinusOne();
		document.getElementById("moolah-preview-storeName").textContent = storeName || "";
		document.getElementById("moolah-preview-zipcode").textContent = zipcode || "";
		document.getElementById("moolah-preview-address1").textContent = address1 || "";
		document.getElementById("moolah-preview-address2").textContent = address2 || "";
		document.getElementById("moolah-preview-city").textContent = city || "";
		document.getElementById("moolah-preview-portal").textContent = portal || "";
		document.getElementById("moolah-preview-email").textContent = email || "";
		document.getElementById("moolah-preview-password").textContent = password || "";
		document.getElementById("moolah-preview-sku").textContent = sku || "";
		document.getElementById("moolah-preview-noOfTabs").textContent = noOfTabs || "";
		document.getElementById("moolah-preview-mokiId").innerHTML = formatMultilinePreview(mokiId);
		document.getElementById("moolah-preview-anydeskId").innerHTML = formatMultilinePreview(anydeskId);

		const stateFull = state ? STATE_FULL_NAMES[state] || "" : "";
		const stateInput = document.getElementById("moolah-state");
		if (stateInput) stateInput.value = stateFull;
		document.getElementById("moolah-preview-stateFull").textContent = stateFull || state || "";

		if (/^\d{5}$/.test(zipcode)) {
			fetchCityFromZip(zipcode, "moolah");
		} else {
			const cityEl = document.getElementById("moolah-city");
			if (cityEl) cityEl.value = "";
			const previewCity = document.getElementById("moolah-preview-city");
			if (previewCity) previewCity.textContent = "";
		}

		const namingLine = `${skuClean}_${statePart}_${storeClean}_LIVE-${portalClean}_${zipClean}_MOOLAH-1`;
		document.getElementById("moolah-preview-namingLine").textContent = namingLine;
		const fullState = state ? STATE_FULL_NAMES[state] || "" : "";
		document.getElementById("moolah-preview-stateFull").textContent = fullState;
		document.getElementById("moolah-preview-timezoneLine").textContent = tzLabel;

		syncPreviewHeight();
	}

	function storeUpdatePreview() {
		const portal = document.getElementById("store-portal").value.trim();
		const storeName = document.getElementById("store-storeName").value.trim();
		const zipcode = document.getElementById("store-zipcode").value.trim();
		const address1 = document.getElementById("store-address1").value.trim();
		const address2 = document.getElementById("store-address2").value.trim();
		const city = document.getElementById("store-city").value.trim();
		const agent = document.getElementById("store-agent").value.trim();
		const email = document.getElementById("store-email").value.trim();
		const password = document.getElementById("store-password").value.trim();
		const sku = document.getElementById("store-sku").value.trim();
		const database = document.getElementById("store-database").value.trim();
		const noOfReg = document.getElementById("store-noOfReg").value.trim();
		const mokiId = document.getElementById("store-mokiId").value.trim();
		const anydeskId = document.getElementById("store-anydeskId").value.trim();

		const url = portal ? `https://portal${portal}.retailzpos.com/` : "https://portal[PORTAL].retailzpos.com/";
		const state = zipcode ? getStateFromZip(zipcode) : "";
		const tzCode = zipcode ? getTimeZoneFromZip(zipcode) : "";
		const tzLabel = tzCode ? getTimeZoneLabel(tzCode) : "";
		const dateStr = storeGetFormattedDateMinusOne();

		document.getElementById("store-preview-url").textContent = url;
		document.getElementById("store-preview-date").textContent = dateStr;
		document.getElementById("store-preview-storeName").textContent = storeName || "";
		document.getElementById("store-preview-zipcode").textContent = zipcode || "";
		document.getElementById("store-preview-address1").textContent = address1 || "";
		document.getElementById("store-preview-address2").textContent = address2 || "";
		document.getElementById("store-preview-city").textContent = city || "";
		document.getElementById("store-preview-portal").textContent = portal || "";
		document.getElementById("store-preview-agent").textContent = agent || "";
		document.getElementById("store-preview-email").textContent = email || "";
		document.getElementById("store-preview-password").textContent = password || "";
		document.getElementById("store-preview-sku").textContent = sku || "";
		document.getElementById("store-preview-database").textContent = database || "";
		document.getElementById("store-preview-noOfReg").textContent = noOfReg || "";
		document.getElementById("store-preview-mokiId").innerHTML = formatMultilinePreview(mokiId);
		document.getElementById("store-preview-anydeskId").innerHTML = formatMultilinePreview(anydeskId);

		const stateFull = state ? STATE_FULL_NAMES[state] || "" : "";
		const stateInput = document.getElementById("store-state");
		if (stateInput) stateInput.value = stateFull;
		document.getElementById("store-preview-stateFull").textContent = stateFull || state || "";

		if (/^\d{5}$/.test(zipcode)) {
			fetchCityFromZip(zipcode, "store");
		} else {
			const cityEl = document.getElementById("store-city");
			if (cityEl) cityEl.value = "";
			const previewCity = document.getElementById("store-preview-city");
			if (previewCity) previewCity.textContent = "";
		}

		const skuPart = sku || "[SKU]";
		const statePart = state || "[STATE]";
		const storeNamePart = storeName || "[STORENAME]";
		const portalPart = portal || "[PORTAL]";
		const zipPart = zipcode || "[ZIPCODE]";
		const skuLine = `${skuPart}_${statePart}_${storeNamePart}_LIVE-${portalPart}_${zipPart}_REG-1`;
		document.getElementById("store-preview-skuLine").textContent = skuLine;
		const fullState = state ? STATE_FULL_NAMES[state] || "" : "";
		document.getElementById("store-preview-stateFull").textContent = fullState;
		document.getElementById("store-preview-timezoneLine").textContent = tzLabel;

		syncPreviewHeight();
	}

	function isHtmlEmpty(html) {
		if (!html) return true;
		const div = document.createElement("div");
		div.innerHTML = html;
		const text = div.textContent || div.innerText || "";
		return text.trim() === "";
	}

	function ticketUpdatePreview() {
		document.getElementById("ticket-previewPortal").textContent = document.getElementById("ticket-portal").value.toUpperCase();
		document.getElementById("ticket-previewStore").textContent = document.getElementById("ticket-store").value.toUpperCase();
		document.getElementById("ticket-previewZip").textContent = document.getElementById("ticket-zip").value.toUpperCase();
		const contactPerson = document.getElementById("ticket-contactPerson").value.toUpperCase();
		document.getElementById("ticket-previewContactPerson").textContent = contactPerson;
		document.getElementById("ticket-previewCaller").textContent = contactPerson;
		document.getElementById("ticket-previewContactNumber").textContent = document.getElementById("ticket-contactNumber").value;
		document.getElementById("ticket-previewContact").textContent = document.getElementById("ticket-contactNumber").value;

		const issueOriginal = document.getElementById("ticket-issue").value;
		document.getElementById("ticket-previewIssue").innerHTML = formatMultilinePreview(issueOriginal);

		const noteRaw = document.getElementById("ticket-note").value;
		document.getElementById("ticket-previewNote").innerHTML = formatMultilinePreview(noteRaw);

		const troubleshootingRaw = document.getElementById("ticket-resolution").value;
		const troubleshootingContent = !isHtmlEmpty(troubleshootingRaw) ? troubleshootingRaw : "";
		document.getElementById("ticket-previewTroubleshooting").innerHTML = troubleshootingContent;

		syncPreviewHeight();
	}

	function updatePreviewWithEntry(entry) {
		document.getElementById("ticket-previewPortal").textContent = entry.portal.toUpperCase();
		document.getElementById("ticket-previewStore").textContent = entry.store.toUpperCase();
		document.getElementById("ticket-previewZip").textContent = entry.zip.toUpperCase();
		document.getElementById("ticket-previewContactPerson").textContent = entry.contact.toUpperCase();
		document.getElementById("ticket-previewCaller").textContent = entry.contact.toUpperCase();
		document.getElementById("ticket-previewContactNumber").textContent = entry.contactNumber;
		document.getElementById("ticket-previewContact").textContent = entry.contactNumber;

		document.getElementById("ticket-previewIssue").innerHTML = formatMultilinePreview(entry.issue || "");
		document.getElementById("ticket-previewNote").innerHTML = formatMultilinePreview(entry.note || "");
		const troubleshootingContent = !isHtmlEmpty(entry.troubleshooting) ? entry.troubleshooting : "";
		document.getElementById("ticket-previewTroubleshooting").innerHTML = troubleshootingContent;
		document.getElementById("ticket-previewResolution").innerHTML = formatMultilinePreview(entry.resolution || "");

		syncPreviewHeight();
	}

	async function summarizeText(text) {
		let apiKey = localStorage.getItem("geminiApiKey");
		if (!apiKey) {
			apiKey = prompt("Enter your Google Gemini API key (get one at makersuite.google.com/app/apikey):");
			if (!apiKey || apiKey.trim() === "") return null;
			localStorage.setItem("geminiApiKey", apiKey.trim());
		}

		const models = ["gemini-2.5-flash-lite", "gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-3-pro-preview", "gemini-3.1-pro-preview", "gemini-2.5-pro", "gemini-pro-latest"];
		let lastError = null;

		for (const model of models) {
			try {
				const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						contents: [
							{
								parts: [
									{
										text: `Summarize briefly . Only output the summarized sentences.\n\n${text}`,
									},
								],
							},
						],
					}),
				});

				if (!response.ok) {
					const errorData = await response.json();
					throw new Error(errorData.error?.message || `HTTP ${response.status}`);
				}

				const data = await response.json();
				return data.candidates[0].content.parts[0].text.trim();
			} catch (error) {
				console.warn(`Model ${model} failed:`, error);
				lastError = error;
			}
		}

		showNotification(`Summarization failed: ${lastError?.message || "No suitable model found."}`);
		if (lastError?.message.includes("API key not valid") || lastError?.message.includes("403")) {
			localStorage.removeItem("geminiApiKey");
			showNotification("API key invalid. Please set a new one.");
		}
		return null;
	}

	async function summarizeEntryResolution(entryId) {
		const entry = allEntries.find((e) => e.id == entryId);
		if (!entry) {
			showNotification("Entry not found.");
			return;
		}

		const troubleshootingText = entry.troubleshooting;
		if (!troubleshootingText || troubleshootingText.trim() === "") {
			showNotification("No troubleshooting steps to summarize.");
			return;
		}

		const allSummarizeBtns = document.querySelectorAll(".summarize-row-btn");
		const targetBtn = Array.from(allSummarizeBtns).find((btn) => btn.dataset.id == entryId);
		if (targetBtn) {
			targetBtn.disabled = true;
			targetBtn.textContent = "⏳";
		}

		const summary = await summarizeText(troubleshootingText);
		if (summary) {
			entry.resolution = summary;
			saveAllEntries();
			renderTable();
			renderSidebar();
			showNotification("Resolution summarized!");
		}

		if (targetBtn) {
			targetBtn.disabled = false;
			targetBtn.textContent = "🔄";
		}
	}

	async function addEntry(prefix) {
		if (prefix !== "ticket") {
			await addEntryLegacy(prefix);
			return;
		}

		let requiredIds = ["ticket-portal", "ticket-store", "ticket-zip"];
		let valid = true;
		requiredIds.forEach((id) => {
			const el = document.getElementById(id);
			el.classList.remove("invalid");
			if (!el.value.trim()) {
				el.classList.add("invalid");
				valid = false;
			}
		});
		if (!valid) {
			showNotification("Please fill PORTAL, STORE NAME, and ZIP CODE!");
			return;
		}
		pushUndo();
		const dateStr = document.getElementById("ticket-date").value;
		const formattedDate = new Date(dateStr).toLocaleDateString("en-US");
		const shift = document.getElementById("ticket-shift").value;
		const support = document.getElementById("ticket-support").value.toUpperCase();
		const portal = document.getElementById("ticket-portal").value;
		const storeName = document.getElementById("ticket-store").value;
		const zipcode = document.getElementById("ticket-zip").value;
		const contactPerson = document.getElementById("ticket-contactPerson").value;
		const contactNumber = document.getElementById("ticket-contactNumber").value;
		const module = document.getElementById("ticket-module").value;
		const issue = document.getElementById("ticket-issue").value;
		const note = document.getElementById("ticket-note").value;
		const escalated = document.getElementById("ticket-escalated").value;
		const status = document.getElementById("ticket-status").value;
		const remarks = document.getElementById("ticket-remarks").value;
		const newTroubleshooting = document.getElementById("ticket-resolution").value;

		const addBtn = document.querySelector("#tab-ticket .add");
		const originalBtnText = addBtn.textContent;
		let resolution = "";

		function isTroubleshootingEmpty(html) {
			if (!html) return true;
			const tempDiv = document.createElement("div");
			tempDiv.innerHTML = html;
			const plainText = tempDiv.textContent || tempDiv.innerText || "";
			return plainText.trim() === "";
		}

		if (editId) {
			const existingEntry = allEntries.find((e) => e.id === editId);
			if (existingEntry) {
				const oldTroubleshooting = existingEntry.troubleshooting || "";
				const troubleshootingChanged = newTroubleshooting !== oldTroubleshooting;
				if (troubleshootingChanged && !isTroubleshootingEmpty(newTroubleshooting)) {
					addBtn.textContent = "⏳ SUMMARIZING...";
					addBtn.disabled = true;
					const plainText = newTroubleshooting.replace(/<[^>]*>/g, "");
					const summary = await summarizeText(plainText);
					if (summary) resolution = summary;
					addBtn.textContent = originalBtnText;
					addBtn.disabled = false;
				} else if (!troubleshootingChanged) {
					resolution = existingEntry.resolution || "";
				} else if (isTroubleshootingEmpty(newTroubleshooting)) {
					resolution = "";
				}
			} else {
				resolution = "";
			}
		} else {
			if (!isTroubleshootingEmpty(newTroubleshooting)) {
				addBtn.textContent = "⏳ SUMMARIZING...";
				addBtn.disabled = true;
				const plainText = newTroubleshooting.replace(/<[^>]*>/g, "");
				const summary = await summarizeText(plainText);
				if (summary) resolution = summary;
				addBtn.textContent = originalBtnText;
				addBtn.disabled = false;
			}
		}

		let newEntry;
		if (editId) {
			const existingEntryIndex = allEntries.findIndex((e) => e.id === editId);
			if (existingEntryIndex !== -1) {
				const existingEntry = allEntries[existingEntryIndex];
				newEntry = {
					...existingEntry,
					id: editId,
					date: formattedDate,
					shift,
					support,
					portal,
					store: storeName,
					zip: zipcode,
					contact: contactPerson,
					contactNumber,
					module,
					issue,
					note,
					escalated,
					status,
					remarks,
					troubleshooting: newTroubleshooting,
					resolution: resolution,
					deleted: false,
					imported: existingEntry.imported || false,
					source: "ticket",
				};
				allEntries[existingEntryIndex] = newEntry;
				showNotification("Entry updated!");
			} else {
				newEntry = {
					id: Date.now(),
					date: formattedDate,
					shift,
					support,
					portal,
					store: storeName,
					zip: zipcode,
					contact: contactPerson,
					contactNumber,
					module,
					issue,
					note,
					escalated,
					status,
					remarks,
					troubleshooting: newTroubleshooting,
					resolution: resolution,
					moduleData: {},
					source: "ticket",
					deleted: false,
					imported: false,
				};
				allEntries.unshift(newEntry);
				showNotification("Entry added (previous entry not found)!");
			}
			editId = null;
			addBtn.textContent = "ADD ENTRY";
			addBtn.classList.remove("editing");
		} else {
			newEntry = {
				id: Date.now(),
				date: formattedDate,
				shift,
				support,
				portal,
				store: storeName,
				zip: zipcode,
				contact: contactPerson,
				contactNumber,
				module,
				issue,
				note,
				escalated,
				status,
				remarks,
				troubleshooting: newTroubleshooting,
				resolution: resolution,
				moduleData: {},
				source: "ticket",
				deleted: false,
				imported: false,
			};
			allEntries.unshift(newEntry);
			showNotification("Entry added!");
		}

		clearFormFields("ticket");
		saveAllEntries();
		updateStatusCounters();
		renderTable();
		renderSidebar();
		syncPreviewHeight();
	}

	async function addEntryLegacy(prefix) {
		const portalEl = document.getElementById(`${prefix}-portal`);
		const storeNameEl = document.getElementById(`${prefix}-storeName`);
		const zipcodeEl = document.getElementById(`${prefix}-zipcode`);
		let valid = true;
		[portalEl, storeNameEl, zipcodeEl].forEach((el) => {
			el.classList.remove("invalid");
			if (!el.value.trim()) {
				el.classList.add("invalid");
				valid = false;
			}
		});
		if (!valid) {
			showNotification("Please fill PORTAL, STORE NAME, and ZIP CODE!");
			return;
		}

		pushUndo();

		const dateStr = document.getElementById(`${prefix}-date`).value;
		const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString("en-US") : storeGetFormattedDateMinusOne();
		const shift = document.getElementById(`${prefix}-shift`).value;
		const support = document.getElementById(`${prefix}-support`).value.toUpperCase();
		const portal = portalEl.value.trim();
		const storeName = storeNameEl.value.trim();
		const zipcode = zipcodeEl.value.trim();

		let issueText = "";
		if (prefix === "store") {
			issueText =
				window._storeCurrentIssue ||
				`NEW STORE CREATION FORM SENT - DONE ✅
STORE CREATION - DONE ✅
INSTALL, UPDATE APPS & LOGIN ACCOUNT - DONE ✅
UPLOAD DATABASE - PENDING ❌`;
		} else if (prefix === "moolah") {
			issueText =
				window._moolahCurrentIssue ||
				`CREATE MOOLAH ACCOUNT - DONE ✅
INSTALL & UPDATE ALL APPS - DONE ✅
ASSIGN STORE - DONE ✅`;
		}

		let moduleData = {};
		if (prefix === "store") {
			moduleData = {
				address1: document.getElementById("store-address1").value,
				address2: document.getElementById("store-address2").value,
				city: document.getElementById("store-city").value,
				state: document.getElementById("store-state").value,
				agent: document.getElementById("store-agent").value,
				email: document.getElementById("store-email").value,
				password: document.getElementById("store-password").value,
				sku: document.getElementById("store-sku").value,
				database: document.getElementById("store-database").value,
				noOfReg: document.getElementById("store-noOfReg").value,
				mokiId: document.getElementById("store-mokiId").value,
				anydeskId: document.getElementById("store-anydeskId").value,
			};
		} else if (prefix === "moolah") {
			moduleData = {
				address1: document.getElementById("moolah-address1").value,
				address2: document.getElementById("moolah-address2").value,
				city: document.getElementById("moolah-city").value,
				state: document.getElementById("moolah-state").value,
				email: document.getElementById("moolah-email").value,
				password: document.getElementById("moolah-password").value,
				sku: document.getElementById("moolah-sku").value,
				noOfTabs: document.getElementById("moolah-noOfTabs").value,
				mokiId: document.getElementById("moolah-mokiId").value,
				anydeskId: document.getElementById("moolah-anydeskId").value,
			};
		}

		const addBtn = document.querySelector(`#tab-${prefix} .add`);

		if (editId) {
			const index = allEntries.findIndex((e) => e.id === editId);
			if (index !== -1) {
				allEntries[index] = {
					...allEntries[index],
					date: formattedDate,
					shift: shift,
					support: support,
					portal: portal,
					store: storeName,
					zip: zipcode,
					issue: issueText,
					moduleData: moduleData,
					status: "OTHER TASK",
					source: prefix,
					deleted: false,
					imported: false,
				};
				showNotification(`${prefix === "store" ? "Store" : "Moolah"} entry updated!`);
			} else {
				const newEntry = {
					id: Date.now(),
					date: formattedDate,
					shift: shift,
					support: support,
					portal: portal,
					store: storeName,
					zip: zipcode,
					contact: "SHIPPING TEAM",
					contactNumber: "(000) 000-0000",
					module: prefix === "store" ? "Store Creation" : "Moolah",
					issue: issueText,
					note: "",
					escalated: "",
					status: "OTHER TASK",
					remarks: "",
					troubleshooting: "",
					resolution: "",
					moduleData: moduleData,
					source: prefix,
					deleted: false,
					imported: false,
				};
				allEntries.unshift(newEntry);
				showNotification(`${prefix === "store" ? "Store" : "Moolah"} entry added (edit target missing)!`);
			}

			editId = null;
			if (addBtn) {
				addBtn.textContent = "ADD ENTRY";
				addBtn.classList.remove("editing");
			}
		} else {
			const newEntry = {
				id: Date.now(),
				date: formattedDate,
				shift: shift,
				support: support,
				portal: portal,
				store: storeName,
				zip: zipcode,
				contact: "SHIPPING TEAM",
				contactNumber: "(000) 000-0000",
				module: prefix === "store" ? "Store Creation" : "Moolah",
				issue: issueText,
				note: "",
				escalated: "",
				status: "OTHER TASK",
				remarks: "",
				troubleshooting: "",
				resolution: "",
				moduleData: moduleData,
				source: prefix,
				deleted: false,
				imported: false,
			};
			allEntries.unshift(newEntry);
			showNotification(`${prefix === "store" ? "Store" : "Moolah"} entry added!`);
		}

		if (prefix === "store") {
			["address1", "address2", "city", "state", "agent", "email", "password", "sku", "database", "noOfReg", "mokiId", "anydeskId"].forEach((id) => {
				const el = document.getElementById(`store-${id}`);
				if (el) el.value = "";
			});
			storeUpdatePreview();
			saveFormData("store");
		} else if (prefix === "moolah") {
			["address1", "address2", "city", "state", "email", "password", "sku", "noOfTabs", "mokiId", "anydeskId"].forEach((id) => {
				const el = document.getElementById(`moolah-${id}`);
				if (el) el.value = "";
			});
			moolahUpdatePreview();
			saveFormData("moolah");
		}

		saveAllEntries();
		updateStatusCounters();
		renderTable();
		renderSidebar();
		syncPreviewHeight();
	}

	function clearFormFields(prefix) {
		if (prefix === "ticket") {
			const fields = ["portal", "store", "zip", "contactPerson", "contactNumber", "module", "issue", "escalated", "status", "remarks", "note"];
			fields.forEach((id) => {
				const el = document.getElementById(`ticket-${id}`);
				if (el) el.value = "";
			});
			const moduleLabel = document.getElementById("ticket-moduleDropdownLabel");
			if (moduleLabel) moduleLabel.textContent = "Select module";
			const moduleSearch = document.getElementById("ticket-module-search");
			if (moduleSearch) moduleSearch.value = "";
			const statusLabel = document.getElementById("ticket-statusDropdownLabel");
			if (statusLabel) statusLabel.textContent = "Select status";
			const statusSearch = document.getElementById("ticket-status-search");
			if (statusSearch) statusSearch.value = "";
			if (quillEditor) {
				quillEditor.root.innerHTML = "";
				document.getElementById("ticket-resolution").value = "";
			}
			document.getElementById("ticket-previewResolution").innerHTML = "";
			document.getElementById("ticket-previewTroubleshooting").innerHTML = "";
			const textareas = document.querySelectorAll(`#tab-ticket textarea`);
			textareas.forEach((ta) => autoGrow(ta));
		} else if (prefix === "store") {
			const fields = ["portal", "storeName", "zipcode", "address1", "address2", "city", "state", "agent", "email", "password", "sku", "database", "noOfReg", "mokiId", "anydeskId"];
			fields.forEach((id) => {
				const el = document.getElementById(`store-${id}`);
				if (el) el.value = "";
			});
			const textareas = document.querySelectorAll(`#tab-store textarea`);
			textareas.forEach((ta) => autoGrow(ta));
		} else if (prefix === "moolah") {
			const fields = ["portal", "storeName", "zipcode", "address1", "address2", "city", "state", "email", "password", "noOfTabs", "sku", "mokiId", "anydeskId"];
			fields.forEach((id) => {
				const el = document.getElementById(`moolah-${id}`);
				if (el) el.value = "";
			});
			const textareas = document.querySelectorAll(`#tab-moolah textarea`);
			textareas.forEach((ta) => autoGrow(ta));
		}

		if (prefix === "ticket") ticketUpdatePreview();
		if (prefix === "store") storeUpdatePreview();
		if (prefix === "moolah") moolahUpdatePreview();
		saveFormData(prefix);
	}

	function clearFormOnly(prefix) {
		clearFormFields(prefix);
		if (editId) {
			editId = null;
			document.querySelector("#tab-moolah .add").textContent = "ADD ENTRY";
			document.querySelector("#tab-moolah .add").classList.remove("editing");
			document.querySelector("#tab-store .add").textContent = "ADD ENTRY";
			document.querySelector("#tab-store .add").classList.remove("editing");
			document.querySelector("#tab-ticket .add").textContent = "ADD ENTRY";
			document.querySelector("#tab-ticket .add").classList.remove("editing");
		}
		showNotification("Form cleared!");
		syncPreviewHeight();
	}

	function editEntry(buttonOrId) {
		let entryId, entry;

		if (typeof buttonOrId === "object" && buttonOrId !== null) {
			const id = buttonOrId.closest ? buttonOrId.closest("tr")?.dataset.id || buttonOrId.dataset.id : buttonOrId.dataset.id;
			if (!id) return;
			entryId = parseInt(id);
		} else if (typeof buttonOrId === "number") {
			entryId = buttonOrId;
		} else {
			return;
		}
		entry = allEntries.find((e) => e.id === entryId);
		if (!entry) return;

		let prefix = entry.source;
		if (!prefix) {
			if (entry.module === "Moolah") prefix = "moolah";
			else if (entry.module === "Store Creation") prefix = "store";
			else prefix = "ticket";
		}

		const tabBtn = Array.from(document.querySelectorAll(".tab-button")).find((btn) => btn.textContent.trim().toLowerCase().includes(prefix));
		if (tabBtn) switchTab(prefix, tabBtn);

		setTimeout(() => {
			const dateParts = entry.date.split("/");
			if (dateParts.length === 3) {
				const month = dateParts[0].padStart(2, "0");
				const day = dateParts[1].padStart(2, "0");
				const year = dateParts[2];
				document.getElementById(`${prefix}-date`).value = `${year}-${month}-${day}`;
			}
			document.getElementById(`${prefix}-shift`).value = entry.shift;
			document.getElementById(`${prefix}-support`).value = entry.support;
			document.getElementById(`${prefix}-portal`).value = entry.portal;

			if (prefix === "moolah" || prefix === "store") {
				document.getElementById(`${prefix}-storeName`).value = entry.store;
				document.getElementById(`${prefix}-zipcode`).value = entry.zip;
			} else {
				document.getElementById(`${prefix}-store`).value = entry.store;
				document.getElementById(`${prefix}-zip`).value = entry.zip;
				document.getElementById(`${prefix}-contactPerson`).value = entry.contact;
				document.getElementById(`${prefix}-contactNumber`).value = entry.contactNumber;
				document.getElementById(`${prefix}-note`).value = entry.note || "";
			}

			if (prefix === "moolah") {
				document.getElementById("moolah-email").value = entry.moduleData?.email || "";
				document.getElementById("moolah-password").value = entry.moduleData?.password || "";
				document.getElementById("moolah-sku").value = entry.moduleData?.sku || "";
				document.getElementById("moolah-noOfTabs").value = entry.moduleData?.noOfTabs || "";
				document.getElementById("moolah-address1").value = entry.moduleData?.address1 || "";
				document.getElementById("moolah-address2").value = entry.moduleData?.address2 || "";
				document.getElementById("moolah-city").value = entry.moduleData?.city || "";
				document.getElementById("moolah-state").value = entry.moduleData?.state || "";
				document.getElementById("moolah-mokiId").value = entry.moduleData?.mokiId || "";
				document.getElementById("moolah-anydeskId").value = entry.moduleData?.anydeskId || "";
				if (entry.issue) {
					window._moolahCurrentIssue = entry.issue;
					if (typeof syncMoolahButtonsFromIssueText === "function") syncMoolahButtonsFromIssueText(entry.issue);
					document.getElementById("moolah-generated-issue").innerText = entry.issue;
				}
			} else if (prefix === "store") {
				document.getElementById("store-agent").value = entry.moduleData?.agent || "";
				document.getElementById("store-email").value = entry.moduleData?.email || "";
				document.getElementById("store-password").value = entry.moduleData?.password || "";
				document.getElementById("store-sku").value = entry.moduleData?.sku || "";
				document.getElementById("store-database").value = entry.moduleData?.database || "";
				document.getElementById("store-noOfReg").value = entry.moduleData?.noOfReg || "";
				document.getElementById("store-address1").value = entry.moduleData?.address1 || "";
				document.getElementById("store-address2").value = entry.moduleData?.address2 || "";
				document.getElementById("store-city").value = entry.moduleData?.city || "";
				document.getElementById("store-state").value = entry.moduleData?.state || "";
				document.getElementById("store-mokiId").value = entry.moduleData?.mokiId || "";
				document.getElementById("store-anydeskId").value = entry.moduleData?.anydeskId || "";
				if (entry.issue) {
					window._storeCurrentIssue = entry.issue;
					if (typeof syncStoreButtonsFromIssueText === "function") syncStoreButtonsFromIssueText(entry.issue);
					document.getElementById("store-generated-issue").innerText = entry.issue;
				}
			} else {
				document.getElementById("ticket-module").value = entry.module;
				const moduleLabel = document.getElementById("ticket-moduleDropdownLabel");
				if (moduleLabel) moduleLabel.textContent = entry.module || "Select module";
				document.getElementById("ticket-issue").value = entry.issue;
				document.getElementById("ticket-escalated").value = entry.escalated;
				document.getElementById("ticket-status").value = entry.status;
				const statusLabel = document.getElementById("ticket-statusDropdownLabel");
				if (statusLabel) statusLabel.textContent = entry.status || "Select status";
				document.getElementById("ticket-remarks").value = entry.remarks;
				if (quillEditor && entry.troubleshooting) {
					quillEditor.root.innerHTML = entry.troubleshooting;
					document.getElementById("ticket-resolution").value = entry.troubleshooting;
				}
			}

			const updatePreview = () => {
				if (prefix === "moolah") moolahUpdatePreview();
				else if (prefix === "store") storeUpdatePreview();
				else updatePreviewWithEntry(entry);
			};
			updatePreview();

			document.querySelectorAll(`#tab-${prefix} input, #tab-${prefix} textarea, #tab-${prefix} select`).forEach((el) => {
				el.dispatchEvent(new Event("input", { bubbles: true }));
			});

			setTimeout(updatePreview, 100);

			editId = entry.id;
			const addBtn = document.querySelector(`#tab-${prefix} .add`);
			if (addBtn) {
				addBtn.textContent = "EDIT ENTRY";
				addBtn.classList.add("editing");
			}

			if (entry.imported) {
				entry.imported = false;
				saveAllEntries();
			}

			document.querySelectorAll(`#tab-${prefix} textarea`).forEach((ta) => autoGrow(ta));
			syncPreviewHeight();
		}, 50);
	}

	function softDeleteEntry(button) {
		const row = button.closest("tr");
		const id = row.dataset.id;
		pushUndo();
		const entry = allEntries.find((e) => e.id == id);
		if (entry) {
			entry.deleted = true;
			saveAllEntries();
			renderTable();
			renderSidebar();
			showNotification("Entry removed from main table (still in history)");
		}

		if (editId == id) {
			editId = null;
			document.querySelector("#tab-moolah .add").textContent = "ADD ENTRY";
			document.querySelector("#tab-moolah .add").classList.remove("editing");
			document.querySelector("#tab-store .add").textContent = "ADD ENTRY";
			document.querySelector("#tab-store .add").classList.remove("editing");
			document.querySelector("#tab-ticket .add").textContent = "ADD ENTRY";
			document.querySelector("#tab-ticket .add").classList.remove("editing");
		}
	}

	function hardDeleteEntry(entryId) {
		const entry = allEntries.find((e) => e.id == entryId);
		if (!entry) {
			showNotification("Entry not found.");
			return;
		}

		if (confirm("Delete this entry permanently? This action cannot be undone.")) {
			pushUndo();
			const index = allEntries.findIndex((e) => e.id == entryId);
			if (index !== -1) {
				allEntries.splice(index, 1);
				saveAllEntries();
				renderTable();
				renderSidebar();
				if (editId == entryId) {
					editId = null;
					document.querySelector("#tab-moolah .add").textContent = "ADD ENTRY";
					document.querySelector("#tab-moolah .add").classList.remove("editing");
					document.querySelector("#tab-store .add").textContent = "ADD ENTRY";
					document.querySelector("#tab-store .add").classList.remove("editing");
					document.querySelector("#tab-ticket .add").textContent = "ADD ENTRY";
					document.querySelector("#tab-ticket .add").classList.remove("editing");
				}
				showNotification("Entry permanently deleted.");
			} else {
				showNotification("Entry not found.");
			}
		}
	}

	function restoreEntry(entryId) {
		const entry = allEntries.find((e) => e.id == entryId);
		if (!entry) {
			showNotification("Entry not found.");
			return;
		}
		if (!entry.deleted) {
			showNotification("Entry is already visible.");
			return;
		}
		pushUndo();
		entry.deleted = false;
		saveAllEntries();
		renderTable();
		renderSidebar();
		showNotification("Entry restored to main table.");
	}

	function copyRow(button) {
		const tds = button.closest("tr").querySelectorAll("td");
		const dataTds = [...tds].slice(1, -1);
		const values = dataTds.map((td) => {
			let text = td.textContent || "";
			return escapeCSV(text);
		});

		navigator.clipboard.writeText(values.join("\t")).then(() => showNotification("Row copied!"));
	}

	function renderTable() {
		const todayEST = getESTDateString();
		const filteredEntries = allEntries.filter((entry) => {
			if (entry.deleted) return false;
			const dateObj = parseDateFromString(entry.date);
			if (!dateObj) return false;
			const entryDateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;
			return entryDateStr <= todayEST;
		});
		const tbody = document.querySelector("#entryTable tbody");
		tbody.innerHTML = "";
		filteredEntries.forEach((entry) => {
			const row = document.createElement("tr");
			row.dataset.id = entry.id;
			row.innerHTML = `<td><input type="checkbox" class="row-checkbox" value="${entry.id}"></td>
                                             <td>${entry.date}</td>
                                             <td>${entry.shift}</td>
                                             <td>${entry.support}</td>
                                             <td>${entry.portal}</td>
                                             <td>${entry.store}</td>
                                             <td>${entry.zip}</td>
                                             <td>${entry.contact}</td>
                                             <td>${entry.contactNumber}</td>
                                             <td>${entry.module}</td>
                                    <td style="white-space: pre-wrap;">${entry.issue || ""}</td>
                                             <td>${entry.escalated}</td>
                                             <td>${entry.status}</td>
                                             <td style="white-space: pre-wrap;">${entry.remarks || ""}</td>
                                    <td style="white-space: pre-wrap;">${entry.resolution || ""}</td>
                                    <td class="action-cell">
                                        <div class="action-container">
                                            <button class="icon-btn copy-btn" onclick="copyRow(this)" title="Copy"><i class="bi bi-clipboard-fill"></i></button>
                                            <button class="icon-btn summarize-row-btn" data-id="${entry.id}" onclick="summarizeEntryResolution(${entry.id})" title="Summarize Resolution"><i class="bi bi-arrow-clockwise"></i></button>
                                            <button class="icon-btn edit-btn" onclick="editEntry(this)" title="Edit"><i class="bi bi-pencil-square"></i></button>
                                            <button class="icon-btn delete-btn" onclick="softDeleteEntry(this)" title="Remove"><i class="bi bi-trash3-fill"></i></button>
                                        </div>
                                        </table>`;
			tbody.appendChild(row);
		});
		updateSelectAllCheckboxState();
		updateStatusCounters();
	}

	function getYesterdayFormatted() {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		return yesterday.toLocaleDateString("en-US", {
			month: "long",
			day: "numeric",
			year: "numeric",
		});
	}

	function renderSidebar() {
		const containers = [document.getElementById("ticketHistoryContent"), document.getElementById("storeHistoryContent"), document.getElementById("moolahHistoryContent")].filter((c) => c);

		if (containers.length === 0) return;

		const now = new Date();
		const currentMonthKey = `${now.toLocaleString("default", { month: "long" })} ${now.getFullYear()}`;
		const yesterdayFormatted = getYesterdayFormatted();

		const historyEntries = allEntries.filter((entry) => !entry.imported);
		const todayEST = getESTDateString();
		const todayFormatted = new Date(todayEST).toLocaleDateString("en-US", {
			month: "long",
			day: "numeric",
			year: "numeric",
		});

		const grouped = {};
		historyEntries.forEach((entry) => {
			if (!entry.date) return;
			const parts = entry.date.split("/");
			if (parts.length !== 3) return;
			const month = parseInt(parts[0], 10);
			const day = parseInt(parts[1], 10);
			const year = parseInt(parts[2], 10);
			const dateObj = new Date(year, month - 1, day);
			const monthKey = `${dateObj.toLocaleString("default", { month: "long" })} ${year}`;
			const dateKey = dateObj.toLocaleDateString("en-US", {
				month: "long",
				day: "numeric",
				year: "numeric",
			});
			if (!grouped[monthKey]) grouped[monthKey] = {};
			if (!grouped[monthKey][dateKey]) grouped[monthKey][dateKey] = [];
			grouped[monthKey][dateKey].push(entry);
		});

		const sortedMonths = Object.keys(grouped).sort((a, b) => {
			const dateA = new Date(a);
			const dateB = new Date(b);
			return dateB - dateA;
		});

		let html = "";
		for (const month of sortedMonths) {
			if (collapseState.months[month] === undefined) {
				collapseState.months[month] = month !== currentMonthKey;
			}
			const isMonthCollapsed = collapseState.months[month];
			const monthArrow = isMonthCollapsed ? "▶" : "▼";
			html += `<div class="sidebar-group">
                    <div class="month-header" onclick="toggleMonth('${month.replace(/'/g, "\\'")}')">
                        <span class="month-arrow">${monthArrow}</span> ${month}
                    </div>`;
			if (!isMonthCollapsed) {
				const dates = grouped[month];
				const sortedDates = Object.keys(dates).sort((a, b) => new Date(b) - new Date(a));
				for (const dateKey of sortedDates) {
					if (collapseState.dates[dateKey] === undefined) {
						collapseState.dates[dateKey] = dateKey !== yesterdayFormatted;
					}
					const isDateCollapsed = collapseState.dates[dateKey];
					const dateArrow = isDateCollapsed ? "▶" : "▼";
					html += `<div class="date-group">
                            <div class="date-header" onclick="toggleDate('${dateKey.replace(/'/g, "\\'")}')">
                                <span class="date-arrow">${dateArrow}</span> ${dateKey}
                            </div>`;
					if (!isDateCollapsed) {
						html += `<div class="date-entries">`;
						for (const entry of dates[dateKey]) {
							let issueDisplay = (entry.issue || "-").toUpperCase();
							if (entry.status && entry.status.toUpperCase() === "OTHER TASK") {
								issueDisplay = entry.module || "OTHER TASK";
							}
							let cardClass = "ticket-card";
							if (entry.source === "store") cardClass = "store-card";
							else if (entry.source === "moolah") cardClass = "moolah-card";

							let issueTextColor = "";
							switch ((entry.status || "").toUpperCase()) {
								case "RESOLVED":
									issueTextColor = "#11734b";
									break;
								case "PENDING":
									issueTextColor = "#b10202";
									break;
								case "OTHER TASK":
									issueTextColor = "#1a6d9f";
									break;
								case "UNSOLVED":
									issueTextColor = "#3d3d3d";
									break;
								default:
									issueTextColor = "";
							}
							const styleIssue = issueTextColor ? `style="color: ${issueTextColor};"` : "";

							html += `
                            <div class="sidebar-card ${cardClass}" data-id="${entry.id}">
                                <div class="preview-item issue-item" ${styleIssue}>${escapeHtml(issueDisplay)}</div>
                                <div class="preview-item"><strong>Portal:</strong> ${escapeHtml(entry.portal || "-")}</div>
                                <div class="preview-item"><strong>Store:</strong> ${escapeHtml(entry.store || "-")}</div>
                                <div class="preview-item"><strong>Zip:</strong> ${escapeHtml(entry.zip || "-")}</div>
                                <div class="card-actions">
                                    <div class="card-actions-row stack-row">
                                        <button class="copy-store" data-id="${entry.id}">📋 DETAILS</button>
                                        <button class="copy-details" data-id="${entry.id}">📋 HRMS</button>
                                    </div>
                                    <div class="card-actions-row">
                                        <button class="edit-entry stack-btn" data-id="${entry.id}">✏️<br>EDIT</button>
                                        <button class="return-entry stack-btn" data-id="${entry.id}">↩️<br>RETURN</button>
                                        <button class="delete-entry stack-btn" data-id="${entry.id}">🗑️<br>DELETE</button>
                                    </div>
                                </div>
                            </div>
                        `;
						}
						html += `</div>`;
					}
					html += `</div>`;
				}
			}
			html += `</div>`;
		}

		if (historyEntries.length === 0) {
			html = '<div style="padding:20px; text-align:center; color:#64748b;">No entries yet.</div>';
		}

		containers.forEach((container) => {
			container.innerHTML = html;
			attachSidebarEvents(container);
		});
	}

	function attachSidebarEvents(container) {
		container.querySelectorAll(".copy-store").forEach((btn) => {
			btn.addEventListener("click", async (e) => {
				e.stopPropagation();
				const id = btn.dataset.id;
				const entry = allEntries.find((e) => e.id == id);
				if (entry) {
					const plainText = `PORTAL: ${entry.portal}
STORE NAME: ${entry.store}
ZIPCODE: ${entry.zip}
CALLER NAME: ${entry.contact}
CONTACT NUMBER: ${entry.contactNumber}

ISSUE:
${entry.issue || ""}

NOTE:
${entry.note || ""}`;

					const htmlContent = `<strong>PORTAL: </strong>${escapeHtml(entry.portal)}<br>
<strong>STORE NAME: </strong>${escapeHtml(entry.store)}<br>
<strong>ZIPCODE: </strong>${escapeHtml(entry.zip)}<br>
<strong>CALLER NAME: </strong>${escapeHtml(entry.contact)}<br>
<strong>CONTACT NUMBER: </strong>${escapeHtml(entry.contactNumber)}<br>
<br>
<strong>ISSUE:</strong><br>
${escapeHtml(entry.issue || "").replace(/\n/g, "<br>")}<br>
<br>
<strong>NOTE:</strong><br>
${escapeHtml(entry.note || "").replace(/\n/g, "<br>")}`;

					try {
						const blobHtml = new Blob([htmlContent], {
							type: "text/html",
						});
						const blobPlain = new Blob([plainText], {
							type: "text/plain",
						});
						await navigator.clipboard.write([
							new ClipboardItem({
								"text/plain": blobPlain,
								"text/html": blobHtml,
							}),
						]);
						showNotification("Details copied (rich format)");
					} catch (err) {
						navigator.clipboard.writeText(plainText);
						showNotification("Details copied (plain text)");
					}
				}
			});
		});

		container.querySelectorAll(".copy-details").forEach((btn) => {
			btn.addEventListener("click", async (e) => {
				e.stopPropagation();
				const id = btn.dataset.id;
				const entry = allEntries.find((e) => e.id == id);
				if (entry) {
					function htmlToPlainText(html) {
						if (!html) return "";
						const temp = document.createElement("div");
						temp.innerHTML = html;
						let result = "";
						function processNode(node, level) {
							if (node.nodeType === Node.TEXT_NODE) {
								let text = node.textContent;
								if (text.trim()) {
									result += text;
								}
								return;
							}
							if (node.nodeType !== Node.ELEMENT_NODE) return;
							const tag = node.tagName.toLowerCase();
							const isBlock = ["p", "div", "li", "ul", "ol", "br"].includes(tag);
							if (tag === "br") {
								result += "\n";
								return;
							}
							if (isBlock && result.length > 0 && !result.endsWith("\n")) {
								result += "\n";
							}
							if (tag === "li") {
								const parentList = node.parentElement;
								const isOrdered = parentList && parentList.tagName.toLowerCase() === "ol";
								let prefix;
								if (isOrdered) {
									const index = Array.from(parentList.children).indexOf(node) + 1;
									prefix = `${index}. `;
								} else {
									prefix = "- ";
								}
								const indent = "\t".repeat(level);
								result += indent + prefix;
							}
							let childLevel = level;
							if (tag === "ul" || tag === "ol") childLevel = level + 1;
							else if (tag === "li") childLevel = level + 1;
							Array.from(node.childNodes).forEach((child) => {
								processNode(child, childLevel);
							});
							if (isBlock && result.length > 0 && !result.endsWith("\n")) {
								result += "\n";
							}
						}
						processNode(temp, 0);
						result = result.replace(/\n\s*\n/g, "\n\n").trim();
						return result;
					}

					const troubleshootingHtml = entry.troubleshooting || "";
					const troubleshootingPlain = htmlToPlainText(troubleshootingHtml);
					const formattedResolution = entry.resolution || "";

					const plainText = `📞 CONTACT:
CALLER NAME: ${entry.contact}
CONTACT NUMBER: ${entry.contactNumber}

🔧 TROUBLESHOOTING:
${troubleshootingPlain}

✅ RESOLUTION:
${formattedResolution}`;

					const htmlCopy = `
<strong>📞 CONTACT: </strong><br>
<strong>CALLER NAME: </strong> ${escapeHtml(entry.contact)}<br>
<strong>CONTACT NUMBER: </strong> ${escapeHtml(entry.contactNumber)}<br>
<br>
<strong>🔧 TROUBLESHOOTING: </strong><br>
${troubleshootingHtml || escapeHtml(troubleshootingPlain).replace(/\n/g, "<br>")}
<br>
<strong>✅ RESOLUTION: </strong><br>
${escapeHtml(formattedResolution).replace(/\n/g, "<br>")}
`;
					try {
						const blob = new Blob([htmlCopy], { type: "text/html" });
						const plainBlob = new Blob([plainText], {
							type: "text/plain",
						});
						await navigator.clipboard.write([
							new ClipboardItem({
								"text/plain": plainBlob,
								"text/html": blob,
							}),
						]);
						showNotification("HRMS details copied (rich format)");
					} catch (err) {
						navigator.clipboard.writeText(plainText);
						showNotification("HRMS details copied (plain text)");
					}
				}
			});
		});

		container.querySelectorAll(".edit-entry").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				e.stopPropagation();
				const id = parseInt(btn.dataset.id);
				editEntry(id);
			});
		});

		container.querySelectorAll(".return-entry").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				e.stopPropagation();
				const id = btn.dataset.id;
				restoreEntry(Number(id));
			});
		});

		container.querySelectorAll(".delete-entry").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				e.stopPropagation();
				const id = btn.dataset.id;
				hardDeleteEntry(Number(id));
			});
		});
	}

	function saveAllEntries() {
		localStorage.setItem("unifiedEntries", JSON.stringify(allEntries));
		updateStatusCounters();
	}

	function loadAllEntries() {
		const saved = localStorage.getItem("unifiedEntries");
		if (saved) {
			try {
				allEntries = JSON.parse(saved);
				allEntries.forEach((entry) => {
					if (entry.troubleshooting === undefined) entry.troubleshooting = entry.resolution || "";
					if (entry.resolution === undefined && entry.originalResolution) entry.resolution = entry.originalResolution;
					if (entry.deleted === undefined) entry.deleted = false;
					if (entry.imported === undefined) entry.imported = false;
					if (entry.note === undefined) entry.note = "";
				});
			} catch (e) {}
		}
		renderTable();
		renderSidebar();
	}

	function getVisibleEntries() {
		const todayEST = getESTDateString();
		return allEntries.filter((entry) => {
			if (entry.deleted) return false;
			const dateObj = parseDateFromString(entry.date);
			if (!dateObj) return false;
			const entryDateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;
			return entryDateStr <= todayEST;
		});
	}

	function getShiftReportBaseDate() {
		const visibleEntries = getVisibleEntries();
		if (visibleEntries.length === 0) {
			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);
			return yesterday;
		}
		const uniqueShifts = [...new Set(visibleEntries.map((e) => e.shift).filter((s) => s))];

		if (uniqueShifts.length === 1 && uniqueShifts[0] === "7:30AM - 6:30PM") {
			return new Date();
		} else {
			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);
			return yesterday;
		}
	}

	function getSelectedRowIds() {
		const checkboxes = document.querySelectorAll("#entryTable tbody .row-checkbox:checked");
		return Array.from(checkboxes).map((cb) => cb.value);
	}

	function bulkDelete() {
		const ids = getSelectedRowIds();
		if (ids.length === 0) {
			showNotification("No rows selected");
			return;
		}
		if (!confirm(`Remove ${ids.length} selected entries from main table? They will remain in history.`)) return;
		pushUndo();
		ids.forEach((id) => {
			const entry = allEntries.find((e) => e.id == id);
			if (entry) entry.deleted = true;
		});
		saveAllEntries();
		renderTable();
		renderSidebar();
		showNotification(`${ids.length} entries hidden from main table (still in history)`);
	}

	function bulkCopy() {
		const ids = getSelectedRowIds();
		if (ids.length === 0) {
			showNotification("No rows selected");
			return;
		}
		const selectedRows = allEntries.filter((entry) => ids.includes(entry.id.toString()));
		selectedRows.reverse();

		const csvContent = selectedRows.map((row) => [row.date, row.shift, row.support, row.portal, row.store, row.zip, row.contact, row.contactNumber, row.module, row.issue || "", row.escalated || "", row.status || "", row.remarks || "", row.resolution || ""].map((field) => escapeCSV(String(field ?? ""))).join("\t")).join("\n");

		navigator.clipboard.writeText(csvContent).then(() => showNotification(`Copied ${selectedRows.length} rows (newest last, no headers)`));
	}

	function bulkUpdateStatus() {
		const ids = getSelectedRowIds();
		if (ids.length === 0) {
			showNotification("No rows selected");
			return;
		}

		const modal = document.createElement("div");
		modal.style.position = "fixed";
		modal.style.top = "50%";
		modal.style.left = "50%";
		modal.style.transform = "translate(-50%, -50%)";
		modal.style.backgroundColor = "#fff";
		modal.style.padding = "24px";
		modal.style.borderRadius = "16px";
		modal.style.boxShadow = "0 20px 35px -10px rgba(0,0,0,0.3)";
		modal.style.zIndex = "1000";
		modal.style.minWidth = "320px";
		modal.style.border = "1px solid #cdddee";

		if (document.body.classList.contains("dark-mode")) {
			modal.style.backgroundColor = "#2d3748";
			modal.style.borderColor = "#4a5568";
			modal.style.color = "#e2e8f0";
		}

		const title = document.createElement("h3");
		title.textContent = "SELECT NEW STATUS";
		title.style.marginBottom = "16px";
		title.style.fontSize = "1.2rem";
		modal.appendChild(title);

		const options = ["RESOLVED", "PENDING", "OTHER TASK", "UNSOLVED"];
		let selectedStatus = options[0];

		options.forEach((status) => {
			const label = document.createElement("label");
			label.style.display = "flex";
			label.style.alignItems = "center";
			label.style.marginBottom = "12px";
			label.style.cursor = "pointer";
			label.style.gap = "8px";

			const radio = document.createElement("input");
			radio.type = "radio";
			radio.name = "status";
			radio.value = status;
			radio.checked = status === selectedStatus;
			radio.style.width = "16px";
			radio.style.height = "16px";
			radio.style.margin = "0";
			radio.style.cursor = "pointer";
			radio.addEventListener("change", () => {
				selectedStatus = status;
			});

			const span = document.createElement("span");
			span.textContent = status;
			span.style.flex = "1";

			label.appendChild(radio);
			label.appendChild(span);
			modal.appendChild(label);
		});

		const buttonRow = document.createElement("div");
		buttonRow.style.display = "flex";
		buttonRow.style.justifyContent = "flex-end";
		buttonRow.style.gap = "8px";
		buttonRow.style.marginTop = "20px";

		const cancelBtn = document.createElement("button");
		cancelBtn.textContent = "CANCEL";
		cancelBtn.style.padding = "8px 16px";
		cancelBtn.style.border = "none";
		cancelBtn.style.borderRadius = "30px";
		cancelBtn.style.cursor = "pointer";
		cancelBtn.style.backgroundColor = "#6b7280";
		cancelBtn.style.color = "white";
		cancelBtn.style.fontWeight = "600";
		cancelBtn.style.textTransform = "uppercase";
		cancelBtn.addEventListener("click", () => {
			document.body.removeChild(backdrop);
			document.body.removeChild(modal);
		});

		const applyBtn = document.createElement("button");
		applyBtn.textContent = "APPLY";
		applyBtn.style.padding = "8px 16px";
		applyBtn.style.border = "none";
		applyBtn.style.borderRadius = "30px";
		applyBtn.style.cursor = "pointer";
		applyBtn.style.backgroundColor = "#2563eb";
		applyBtn.style.color = "white";
		applyBtn.style.fontWeight = "600";
		applyBtn.style.textTransform = "uppercase";
		applyBtn.addEventListener("click", () => {
			pushUndo();
			allEntries = allEntries.map((entry) => {
				if (ids.includes(entry.id.toString())) {
					entry.status = selectedStatus;
				}
				return entry;
			});
			saveAllEntries();
			updateStatusCounters();
			renderTable();
			renderSidebar();
			document.body.removeChild(backdrop);
			document.body.removeChild(modal);
			showNotification(`Updated ${ids.length} entries to ${selectedStatus}`);
		});

		buttonRow.appendChild(cancelBtn);
		buttonRow.appendChild(applyBtn);
		modal.appendChild(buttonRow);

		const backdrop = document.createElement("div");
		backdrop.style.position = "fixed";
		backdrop.style.top = "0";
		backdrop.style.left = "0";
		backdrop.style.width = "100%";
		backdrop.style.height = "100%";
		backdrop.style.backgroundColor = "rgba(0,0,0,0.5)";
		backdrop.style.zIndex = "999";
		backdrop.addEventListener("click", () => {
			document.body.removeChild(backdrop);
			document.body.removeChild(modal);
		});

		document.body.appendChild(backdrop);
		document.body.appendChild(modal);
	}

	function exportToCSV() {
		const visibleEntries = getVisibleEntries();

		const headers = ["DATE", "SHIFT", "SUPPORT", "PORTAL", "STORE", "ZIP", "CONTACT", "CONTACT#", "MODULE", "ISSUE", "ESCALATED", "STATUS", "REMARKS", "RESOLUTION"];
		const rows = visibleEntries.map((entry) => [entry.date, entry.shift, entry.support, entry.portal, entry.store, entry.zip, entry.contact, entry.contactNumber, entry.module, entry.issue, entry.escalated, entry.status, entry.remarks, entry.resolution].map((field) => escapeCSV(field ?? "")).join(","));

		const csv = [headers.join(","), ...rows].join("\n");
		const blob = new Blob(["\uFEFF" + csv], {
			type: "text/csv;charset=utf-8",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `retailzpos_daily_${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);

		showNotification(`✅ Exported ${visibleEntries.length} entries (only visible in database panel)`);
	}

	function parseCSV(text) {
		const rows = [];
		let row = [];
		let field = "";
		let inQuotes = false;
		for (let i = 0; i < text.length; i++) {
			const c = text[i];
			const next = text[i + 1];
			if (inQuotes) {
				if (c === '"' && next === '"') {
					field += '"';
					i++;
				} else if (c === '"') {
					inQuotes = false;
				} else {
					field += c;
				}
			} else {
				if (c === '"') {
					inQuotes = true;
				} else if (c === ",") {
					row.push(field);
					field = "";
				} else if (c === "\n" || c === "\r") {
					if (c === "\r" && next === "\n") i++;
					row.push(field);
					rows.push(row);
					row = [];
					field = "";
				} else {
					field += c;
				}
			}
		}
		if (field !== "" || inQuotes) row.push(field);
		if (row.length > 0) rows.push(row);
		return rows;
	}

	function importFromCSV(event) {
		const file = event.target.files[0];
		if (!file) return;
		const reader = new FileReader();
		reader.readAsText(file, "UTF-8");
		reader.onload = (e) => {
			const text = e.target.result;
			const cleanText = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
			const rows = parseCSV(cleanText);
			if (rows.length === 0) {
				showNotification("CSV file is empty");
				return;
			}
			const headers = rows[0];
			const expected = ["DATE", "SHIFT", "SUPPORT", "PORTAL", "STORE", "ZIP", "CONTACT", "CONTACT#", "MODULE", "ISSUE", "ESCALATED", "STATUS", "REMARKS", "RESOLUTION"];
			if (!expected.every((h, i) => h === headers[i])) {
				showNotification("CSV headers do not match expected format");
				return;
			}
			const newEntries = [];
			let skippedEmptyDate = 0;
			for (let i = 1; i < rows.length; i++) {
				const values = rows[i];
				if (values.length < expected.length) continue;
				const dateValue = values[0] ? values[0].trim() : "";
				if (!dateValue) {
					skippedEmptyDate++;
					continue;
				}
				const entry = {
					id: Date.now() + i + Math.random(),
					date: values[0],
					shift: values[1],
					support: values[2],
					portal: values[3],
					store: values[4],
					zip: values[5],
					contact: values[6],
					contactNumber: values[7],
					module: values[8],
					issue: values[9],
					escalated: values[10],
					status: values[11],
					remarks: values[12],
					resolution: values[13],
					troubleshooting: "",
					note: "",
					moduleData: {},
					source: "ticket",
					deleted: false,
					imported: true,
				};
				newEntries.push(entry);
			}
			if (newEntries.length === 0) {
				showNotification(skippedEmptyDate ? `No valid entries found (${skippedEmptyDate} rows had empty date)` : "No valid entries found in CSV");
				return;
			}
			pushUndo();
			allEntries = [...newEntries, ...allEntries];
			saveAllEntries();
			renderTable();
			renderSidebar();
			let msg = `✅ Imported ${newEntries.length} entries into today's database panel`;
			if (skippedEmptyDate) msg += `, skipped ${skippedEmptyDate} rows with empty date`;
			showNotification(msg);
		};
		reader.onerror = () => {
			showNotification("Error reading file");
		};
		event.target.value = "";
	}

	function generateShiftReportPlain() {
		const indent = (level) => " ".repeat(level * 5);
		const visible = getVisibleEntries();
		const baseDate = getShiftReportBaseDate();
		const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
		const dateStr = baseDate.toLocaleDateString("en-US");
		const dayName = days[baseDate.getDay()];
		const dateLine = `Date: ${dateStr} - ${dayName} Shift`;

		const uniqueShifts = [...new Set(visible.map((e) => e.shift).filter((s) => s))];
		const shiftLine = `Shift: ${uniqueShifts.join(", ")}`;

		const pendingEntries = visible.filter((e) => e.status?.toUpperCase() === "PENDING");
		const pendingCount = pendingEntries.length;
		let pendingList = "";
		if (pendingCount > 0) {
			pendingList = pendingEntries.map((e) => `${indent(1)}${e.store || "Unknown Store"} - ${e.issue || "No issue details"}`).join("\n");
		} else {
			pendingList = `${indent(1)}No Pending Tickets`;
		}

		const totalCalls = visible.filter((e) => e.status?.toUpperCase() !== "OTHER TASK").length;

		const otherEntries = visible.filter((e) => e.status?.toUpperCase() === "OTHER TASK");
		const otherCount = otherEntries.length;
		let otherList = "";
		if (otherCount > 0) {
			const uniqueItems = new Set();
			otherEntries.forEach((e) => {
				const moduleName = e.module && e.module.trim() ? e.module : "";
				if (moduleName.toUpperCase() === "OTHER") {
					const issueText = e.issue ? e.issue.trim() : "";
					const display = issueText || "Other";
					uniqueItems.add(display);
				} else {
					const display = moduleName || "Other";
					uniqueItems.add(display);
				}
			});
			otherList = Array.from(uniqueItems)
				.map((item) => `${indent(1)}${item}`)
				.join("\n");
		} else {
			otherList = `${indent(1)}No Other Tasks`;
		}

		const trainingEntries = otherEntries.filter((e) => e.module?.toUpperCase() === "TRAINING");
		const demoEntries = otherEntries.filter((e) => e.module?.toUpperCase() === "DEMO");
		const trainingLine = trainingEntries.length > 0 ? `${indent(2)}Scheduled Training: ${trainingEntries.map((e) => e.support || "Unknown Support").join(", ")}` : `${indent(2)}No Training for today`;
		const demoLine = demoEntries.length > 0 ? `${indent(2)}Scheduled Demo: ${demoEntries.map((e) => e.support || "Unknown Support").join(", ")}` : `${indent(2)}No Demo for today`;

		const staticSections = `${indent(1)}5. Updates / Notices
${indent(2)}The current latest versions:
${indent(3)}RetailzPOS: Version Code 227 (Portal 1, 2, 3, 4, 6, 7, 8)
${indent(3)}Moolah Points: Version Code 39 (Portal 1, 2, 3, 4, 6, 7, 8)

${indent(2)}Reminders for Retailz team members:
${indent(2)}- Any database-related issues must be escalated to a senior team member immediately. These involve sensitive data where zero errors are acceptable.
${indent(2)}- Ask seniors assistance for issue that needed to be escalated to the India team
${indent(2)}- Observe professional call etiquette at all times when handling calls.
${indent(2)}- Follow up on any pending tickets and ensure timely updates.
${indent(2)}- Review pending issues and escalations using the newly added features in our existing workload tracker
${indent(2)}- Kindly ensure that all details are thoroughly recorded in the tracker/HRMS. This will allow the next person assisting the merchant to refer to the existing information and prevent repetitive inquiries.
${indent(2)}- Use clear and proper escalation notes within the tracker to provide transparency and maintain an accurate issue history.

${indent(1)}6. Training (Retailz Members): No training for today

${indent(1)}7. Tasks/Tickets to be Delegated: No delegated task for today`;

		return [dateLine, shiftLine, "", "Good day everyone,", "", "Please find below the shift report for today,", "", `${indent(1)}1. Pending Tickets: ${pendingCount}`, pendingList, "", `${indent(1)}2. Total Calls: ${totalCalls}`, "", "", `${indent(1)}3. Total Other Tasks: ${otherCount}`, otherList, "", `${indent(1)}4. Scheduled Training/Demo (Merchant)`, trainingLine, demoLine, "", staticSections].join("\n");
	}

	function generateShiftReportHTML() {
		const visible = getVisibleEntries();
		const baseDate = getShiftReportBaseDate();
		const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
		const dateStr = baseDate.toLocaleDateString("en-US");
		const dayName = days[baseDate.getDay()];
		const dateLine = `Date: ${dateStr} - ${dayName} Shift`;

		const uniqueShifts = [...new Set(visible.map((e) => e.shift).filter((s) => s))];
		const shiftLine = `Shift: ${uniqueShifts.join(", ")}`;

		const pendingEntries = visible.filter((e) => e.status?.toUpperCase() === "PENDING");
		const pendingCount = pendingEntries.length;
		let pendingListHtml = "";
		if (pendingCount > 0) {
			pendingListHtml = pendingEntries
				.map((e) => {
					const storeName = escapeHtml(e.store || "Unknown Store");
					const issueText = escapeHtml(e.issue || "No issue details");
					return `<div style="margin-left:25px;"><b>${storeName}</b> - <i>${issueText}</i></div>`;
				})
				.join("");
		} else {
			pendingListHtml = `<div style="margin-left:25px;">No Pending Tickets</div>`;
		}

		const totalCalls = visible.filter((e) => e.status?.toUpperCase() !== "OTHER TASK").length;

		const otherEntries = visible.filter((e) => e.status?.toUpperCase() === "OTHER TASK");
		const otherCount = otherEntries.length;
		let otherListHtml = "";
		if (otherCount > 0) {
			const uniqueItems = new Set();
			otherEntries.forEach((e) => {
				const moduleName = e.module && e.module.trim() ? e.module : "";
				if (moduleName.toUpperCase() === "OTHER") {
					const issueText = e.issue ? e.issue.trim() : "";
					const display = issueText || "Other";
					uniqueItems.add(display);
				} else {
					const display = moduleName || "Other";
					uniqueItems.add(display);
				}
			});
			otherListHtml = Array.from(uniqueItems)
				.map((item) => `<div style="margin-left:25px;">${escapeHtml(item)}</div>`)
				.join("");
		} else {
			otherListHtml = `<div style="margin-left:25px;">No Other Tasks</div>`;
		}

		const trainingEntries = otherEntries.filter((e) => e.module?.toUpperCase() === "TRAINING");
		const demoEntries = otherEntries.filter((e) => e.module?.toUpperCase() === "DEMO");
		const trainingLine = trainingEntries.length > 0 ? `<div style="margin-left:25px;">Scheduled Training: ${escapeHtml(trainingEntries.map((e) => e.support || "Unknown Support").join(", "))}</div>` : `<div style="margin-left:25px;">No Training for today</div>`;
		const demoLine = demoEntries.length > 0 ? `<div style="margin-left:25px;">Scheduled Demo: ${escapeHtml(demoEntries.map((e) => e.support || "Unknown Support").join(", "))}</div>` : `<div style="margin-left:25px;">No Demo for today</div>`;

		const versionHtml = `
        <div style="margin-left:25px;">The current latest versions:</div>
        <div style="margin-left:50px;">RetailzPOS: Version Code 227 (Portal 1, 2, 3, 4, 6, 7, 8)</div>
        <div style="margin-left:50px;">Moolah Points: Version Code 39 (Portal 1, 2, 3, 4, 6, 7, 8)</div>
    `;

		const remindersItems = ["Any database-related issues must be escalated to a senior team member immediately. These involve sensitive data where zero errors are acceptable.", "Ask seniors assistance for issue that needed to be escalated to the India team", "Observe professional call etiquette at all times when handling calls.", "Follow up on any pending tickets and ensure timely updates.", "Review pending issues and escalations using the newly added features in our existing workload tracker", "Kindly ensure that all details are thoroughly recorded in the tracker/HRMS. This will allow the next person assisting the merchant to refer to the existing information and prevent repetitive inquiries.", "Use clear and proper escalation notes within the tracker to provide transparency and maintain an accurate issue history."];
		const remindersListHtml = `<ul style="margin:4px 0 0 25px; padding-left:20px;">` + remindersItems.map((item) => `<li style="margin:0;">${escapeHtml(item)}</li>`).join("") + `</ul>`;

		const staticSections = `
        <div><strong>5. Updates / Notices</strong></div>
        ${versionHtml}
        <div style="margin-top:8px;"></div>
        <div style="margin-left:25px;">Reminders for Retailz team members:</div>
        ${remindersListHtml}
        <div style="margin-top:8px;"><strong>6. Training (Retailz Members):</strong> No training for today</div>
        <div style="margin-top:4px;"><strong>7. Tasks/Tickets to be Delegated:</strong> No delegated task for today</div>
    `;

		return `
        <div style="font-family: sans-serif; line-height:1.4;">
            <div>${escapeHtml(dateLine)}</div>
            <div>${escapeHtml(shiftLine)}</div>
            <div><br></div>
            <div>Good day everyone,</div>
            <div><br></div>
            <div>Please find below the shift report for today,</div>
            <div><br></div>
            <div><strong>1. Pending Tickets: ${pendingCount}</strong></div>
            ${pendingListHtml}
            <div><br></div>
            <div><strong>2. Total Calls: ${totalCalls}</strong></div>
            <div><br></div>
            <div><br></div>
            <div><strong>3. Total Other Tasks: ${otherCount}</strong></div>
            ${otherListHtml}
            <div><br></div>
            <div><strong>4. Scheduled Training/Demo (Merchant)</strong></div>
            ${trainingLine}
            ${demoLine}
            <div><br></div>
            ${staticSections}
        </div>
    `;
	}

	function showShiftReportModal() {
		const plainText = generateShiftReportPlain();
		const htmlContent = generateShiftReportHTML();

		const modal = document.createElement("div");
		modal.style.position = "fixed";
		modal.style.top = "50%";
		modal.style.left = "50%";
		modal.style.transform = "translate(-50%, -50%)";
		modal.style.backgroundColor = "#fff";
		modal.style.padding = "24px";
		modal.style.borderRadius = "16px";
		modal.style.boxShadow = "0 20px 35px -10px rgba(0,0,0,0.3)";
		modal.style.zIndex = "1000";
		modal.style.minWidth = "600px";
		modal.style.maxWidth = "800px";
		modal.style.maxHeight = "80vh";
		modal.style.overflowY = "auto";
		modal.style.border = "1px solid #cdddee";

		if (document.body.classList.contains("dark-mode")) {
			modal.style.backgroundColor = "#2d3748";
			modal.style.borderColor = "#4a5568";
			modal.style.color = "#e2e8f0";
		}

		const title = document.createElement("h3");
		title.textContent = "End‑of‑Shift Report";
		title.style.marginBottom = "16px";
		title.style.fontSize = "1.2rem";
		modal.appendChild(title);

		const pre = document.createElement("pre");
		pre.textContent = plainText;
		pre.style.whiteSpace = "pre-wrap";
		pre.style.fontFamily = "monospace";
		pre.style.fontSize = "13px";
		pre.style.lineHeight = "1.5";
		pre.style.margin = "0";
		pre.style.padding = "12px";
		pre.style.backgroundColor = document.body.classList.contains("dark-mode") ? "#1e293b" : "#f8fafc";
		pre.style.borderRadius = "12px";
		pre.style.border = "1px solid var(--border-color)";
		pre.style.overflowX = "auto";
		pre.style.maxHeight = "400px";
		modal.appendChild(pre);

		const buttonRow = document.createElement("div");
		buttonRow.style.display = "flex";
		buttonRow.style.justifyContent = "flex-end";
		buttonRow.style.gap = "8px";
		buttonRow.style.marginTop = "16px";

		const copyBtn = document.createElement("button");
		copyBtn.textContent = "Copy to Clipboard";
		copyBtn.style.padding = "8px 16px";
		copyBtn.style.border = "none";
		copyBtn.style.borderRadius = "30px";
		copyBtn.style.cursor = "pointer";
		copyBtn.style.backgroundColor = "#2563eb";
		copyBtn.style.color = "white";
		copyBtn.addEventListener("click", async () => {
			try {
				const clipboardItems = [
					new ClipboardItem({
						"text/plain": new Blob([plainText], { type: "text/plain" }),
						"text/html": new Blob([htmlContent], { type: "text/html" }),
					}),
				];
				await navigator.clipboard.write(clipboardItems);
				showNotification("Report copied (rich format)!");
			} catch (err) {
				navigator.clipboard.writeText(plainText);
				showNotification("Plain text copied (rich copy failed)");
			}
		});

		const closeBtn = document.createElement("button");
		closeBtn.textContent = "Close";
		closeBtn.style.padding = "8px 16px";
		closeBtn.style.border = "none";
		closeBtn.style.borderRadius = "30px";
		closeBtn.style.cursor = "pointer";
		closeBtn.style.backgroundColor = "#6b7280";
		closeBtn.style.color = "white";
		closeBtn.addEventListener("click", () => {
			document.body.removeChild(backdrop);
			document.body.removeChild(modal);
		});

		buttonRow.appendChild(copyBtn);
		buttonRow.appendChild(closeBtn);
		modal.appendChild(buttonRow);

		const backdrop = document.createElement("div");
		backdrop.style.position = "fixed";
		backdrop.style.top = "0";
		backdrop.style.left = "0";
		backdrop.style.width = "100%";
		backdrop.style.height = "100%";
		backdrop.style.backgroundColor = "rgba(0,0,0,0.5)";
		backdrop.style.zIndex = "999";
		backdrop.addEventListener("click", () => {
			document.body.removeChild(backdrop);
			document.body.removeChild(modal);
		});

		document.body.appendChild(backdrop);
		document.body.appendChild(modal);
	}

	function updateSelectAllCheckboxState() {
		const selectAllBar = document.getElementById("selectAllCheckbox");
		const rowCheckboxes = document.querySelectorAll("#entryTable tbody .row-checkbox");
		const allChecked = rowCheckboxes.length > 0 && Array.from(rowCheckboxes).every((cb) => cb.checked);
		selectAllBar.checked = allChecked;
	}

	function handleSelectAll(checkbox) {
		const checked = checkbox.checked;
		document.querySelectorAll("#entryTable tbody .row-checkbox").forEach((cb) => (cb.checked = checked));
		updateSelectAllCheckboxState();
	}

	function initTheme() {
		const savedTheme = localStorage.getItem("theme");
		if (savedTheme === "dark") {
			document.body.classList.add("dark-mode");
			document.getElementById("themeToggle").textContent = "☀️";
		} else {
			document.body.classList.remove("dark-mode");
			document.getElementById("themeToggle").textContent = "🌙";
		}
	}

	function toggleTheme() {
		const isDark = document.body.classList.toggle("dark-mode");
		localStorage.setItem("theme", isDark ? "dark" : "light");
		document.getElementById("themeToggle").textContent = isDark ? "☀️" : "🌙";
		syncPreviewHeight();
	}

	function getBootstrapDropdownDefaultLabel(inputId) {
		if (inputId === "ticket-status") return "Select status";
		if (inputId === "ticket-module") return "Select module";
		if (inputId === "ticket-shift") return "Select shift";
		return "Select";
	}

	function setBootstrapDropdownValue(inputId, value) {
		const input = document.getElementById(inputId);
		const label = document.getElementById(`${inputId}DropdownLabel`);
		const defaultLabel = getBootstrapDropdownDefaultLabel(inputId);
		if (input) input.value = value || "";
		if (label) label.textContent = value ? value : defaultLabel;
	}

	function setupBootstrapDropdown(inputId, options, nextFieldId) {
		const input = document.getElementById(inputId);
		const dropdownBtn = document.getElementById(`${inputId}-dropdown-btn`);
		const menu = document.getElementById(`${inputId}DropdownMenu`);
		const searchInput = document.getElementById(`${inputId}-search`);
		if (!input || !dropdownBtn || !menu || !searchInput) return;

		function renderMenu(filter = "") {
			const query = filter.trim().toLowerCase();
			const filtered = query === "" ? options.slice() : options.filter((opt) => opt.toLowerCase().includes(query));
			menu.innerHTML = "";

			if (filtered.length === 0) {
				const emptyItem = document.createElement("div");
				emptyItem.className = "dropdown-item text-muted";
				emptyItem.textContent = "No matching options";
				menu.appendChild(emptyItem);
				return;
			}

			filtered.forEach((opt) => {
				const item = document.createElement("button");
				item.type = "button";
				item.className = "dropdown-item";
				item.textContent = opt;
				item.addEventListener("click", () => {
					setBootstrapDropdownValue(inputId, opt);
					input.dispatchEvent(new Event("input", { bubbles: true }));
					input.dispatchEvent(new Event("change", { bubbles: true }));
					if (nextFieldId) {
						setTimeout(() => document.getElementById(nextFieldId)?.focus(), 10);
					}
				});
				menu.appendChild(item);
			});
		}

		dropdownBtn.addEventListener("click", () => {
			searchInput.value = "";
			renderMenu("");
			setTimeout(() => searchInput.focus(), 0);
		});

		searchInput.addEventListener("input", function () {
			renderMenu(this.value);
		});

		searchInput.addEventListener("keydown", function (e) {
			if (e.key === "Escape") {
				dropdownBtn.focus();
			}
		});

		setBootstrapDropdownValue(inputId, input.value);
		renderMenu("");
	}

	function setupAutocomplete(inputId, options, nextFieldId) {
		const input = document.getElementById(inputId);
		const listId = inputId + "List";
		const datalist = document.getElementById(listId);

		datalist.innerHTML = "";
		options.forEach((opt) => {
			const option = document.createElement("option");
			option.value = opt;
			datalist.appendChild(option);
		});

		input.addEventListener("input", function () {
			const val = this.value.toLowerCase();
			datalist.innerHTML = "";
			const filtered = options.filter((opt) => opt.toLowerCase().includes(val));
			filtered.forEach((opt) => {
				const option = document.createElement("option");
				option.value = opt;
				datalist.appendChild(option);
			});
			if (filtered.length === 0) {
				options.forEach((opt) => {
					const option = document.createElement("option");
					option.value = opt;
					datalist.appendChild(option);
				});
			}
		});

		input.addEventListener("keydown", function (e) {
			if (e.key === "Tab") {
				const options = Array.from(datalist.children);
				if (options.length > 0 && this.value) {
					const matches = options.filter((opt) => opt.value.toLowerCase().includes(this.value.toLowerCase()));
					if (matches.length > 0) {
						e.preventDefault();
						this.value = matches[0].value;
						const event = new Event("input", { bubbles: true });
						this.dispatchEvent(event);
						if (nextFieldId) {
							setTimeout(() => document.getElementById(nextFieldId).focus(), 10);
						}
					}
				} else if (options.length > 0) {
					e.preventDefault();
					this.value = options[0].value;
					const event = new Event("input", { bubbles: true });
					this.dispatchEvent(event);
					if (nextFieldId) {
						setTimeout(() => document.getElementById(nextFieldId).focus(), 10);
					}
				}
			}
		});
	}

	function checkAndRefreshTable() {
		const todayEST = getESTDateString();
		const storedDate = localStorage.getItem("lastClearDate");

		if (storedDate !== todayEST) {
			archiveOldEntries();
			saveAllEntries();
			renderTable();
			renderSidebar();
			showNotification(`New day detected. Previous entries moved to history.`);
			setTimeout(() => {
				window.location.reload();
			}, 2000);
			localStorage.setItem("lastClearDate", todayEST);
		}
	}

	function archiveOldEntries() {
		const today = getESTDateString();
		allEntries.forEach((entry) => {
			if (entry.deleted) return;
			const dateObj = parseDateFromString(entry.date);
			if (!dateObj) return;
			const yyyy = dateObj.getFullYear();
			const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
			const dd = String(dateObj.getDate()).padStart(2, "0");
			const entryDate = `${yyyy}-${mm}-${dd}`;
			if (entryDate < today) {
				entry.deleted = true;
			}
		});
	}

	let credentials = [];

	async function loadCredentials() {
		const apiKey = getGoogleApiKey();
		if (!apiKey) throw new Error("API key not set");
		const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.GOOGLE_SHEET_ID}/values/${encodeURIComponent(CONFIG.CRED_SHEET_NAME)}?key=${apiKey}`;
		const response = await fetch(url);
		if (!response.ok) throw new Error("Failed to load credentials");
		const data = await response.json();
		if (!data.values || data.values.length < 2) throw new Error("No credentials found");
		credentials = [];
		for (let i = 1; i < data.values.length; i++) {
			const row = data.values[i];
			const support = (row[0] || "").trim();
			const email = (row[1] || "").trim();
			const password = (row[2] || "").trim();
			const role = (row[3] || "").trim().toUpperCase();
			if (email && password) {
				credentials.push({ support, email, password, role });
			}
		}
	}

	function getLoggedInUser() {
		const stored = localStorage.getItem("loggedInUser");
		return stored ? JSON.parse(stored) : null;
	}

	function setLoggedInUser(user) {
		localStorage.setItem("loggedInUser", JSON.stringify(user));
	}

	function clearLoggedInUser() {
		localStorage.removeItem("loggedInUser");
	}

	function showLoginError(msg) {
		document.getElementById("loginError").textContent = msg;
	}

	function applyRoleRestrictions(role) {
		role = role.toUpperCase();
		const pendingToggleBtn = document.getElementById("pendingTrackerToggleBtn");

		if (role === "LEVEL 1") {
			document.querySelectorAll(".tab-button").forEach((btn) => {
				const text = btn.textContent.toUpperCase();
				if (text.includes("MOOLAH") || text.includes("STORE")) {
					btn.style.display = "none";
				}
			});

			document.getElementById("importCsvBtn").style.display = "none";
			document.getElementById("exportCsvBtn").style.display = "none";
			document.getElementById("shiftReportBtn").style.display = "none";

			if (pendingToggleBtn) pendingToggleBtn.style.display = "";
		} else if (role === "LEVEL 2") {
			document.getElementById("importCsvBtn").style.display = "none";
			document.getElementById("exportCsvBtn").style.display = "none";
			document.getElementById("shiftReportBtn").style.display = "none";
			if (pendingToggleBtn) pendingToggleBtn.style.display = "";
		} else {
			if (pendingToggleBtn) pendingToggleBtn.style.display = "";
		}
	}

	function autoFillSupportName(supportName) {
		document.getElementById("ticket-support").value = supportName;
		document.getElementById("ticket-support").readOnly = true;
		document.getElementById("store-support").value = supportName;
		document.getElementById("store-support").readOnly = true;
		document.getElementById("moolah-support").value = supportName;
		document.getElementById("moolah-support").readOnly = true;

		syncShiftSupportFromTicket();
	}

	function setupLoginListeners() {
		const loginBtn = document.getElementById("loginBtn");
		const setSheetsBtn = document.getElementById("setSheetsKeyFromLogin");
		const setGeminiBtn = document.getElementById("setGeminiKeyFromLogin");
		const togglePwd = document.getElementById("togglePassword");
		const loginEmail = document.getElementById("loginEmail");
		const loginPassword = document.getElementById("loginPassword");
		const keyStatusEl = document.getElementById("keyStatus");

		function updateKeyStatus() {
			const sheetsKey = getGoogleApiKey();
			const geminiKey = localStorage.getItem("geminiApiKey");
			const bothSet = sheetsKey && geminiKey;
			loginBtn.disabled = !bothSet;
			if (!bothSet) {
				const missing = [];
				if (!sheetsKey) missing.push("Sheets API Key");
				if (!geminiKey) missing.push("Gemini API Key");
				keyStatusEl.textContent = `⚠️ Missing: ${missing.join(", ")}. Please set both keys before login.`;
			} else {
				keyStatusEl.textContent = "✅ Both API keys are set. You can login.";
			}
		}
		updateKeyStatus();

		setSheetsBtn.addEventListener("click", () => {
			const key = prompt("Enter your Google Sheets API key:");
			if (key !== null) {
				if (key.trim() === "") {
					localStorage.removeItem("googleApiKey");
				} else {
					localStorage.setItem("googleApiKey", key.trim());
				}
				updateKeyStatus();
				showNotification(key.trim() ? "Sheets API key saved." : "Sheets API key removed.");
			}
		});

		setGeminiBtn.addEventListener("click", () => {
			const key = prompt("Enter your Google Gemini API key:");
			if (key !== null) {
				if (key.trim() === "") {
					localStorage.removeItem("geminiApiKey");
				} else {
					localStorage.setItem("geminiApiKey", key.trim());
				}
				updateKeyStatus();
				showNotification(key.trim() ? "Gemini API key saved." : "Gemini API key removed.");
			}
		});

		togglePwd.addEventListener("click", () => {
			const type = loginPassword.getAttribute("type") === "password" ? "text" : "password";
			loginPassword.setAttribute("type", type);
			togglePwd.textContent = type === "password" ? "🙉" : "🙈";
		});

		loginBtn.addEventListener("click", async () => {
			const email = loginEmail.value.trim();
			const pwd = loginPassword.value.trim();
			if (!email || !pwd) {
				showLoginError("Please enter email and password.");
				return;
			}

			if (!getGoogleApiKey() || !localStorage.getItem("geminiApiKey")) {
				showLoginError("Both API keys must be set before logging in.");
				return;
			}
			try {
				await loadCredentials();
				const user = credentials.find((c) => c.email.toLowerCase() === email.toLowerCase() && c.password === pwd);
				if (!user) {
					showLoginError("Invalid email or password.");
					return;
				}
				setLoggedInUser({
					email: user.email,
					support: user.support,
					role: user.role,
				});
				showNotification(`Welcome, ${user.support}!`);
				location.reload();
			} catch (err) {
				showLoginError(`Error: ${err.message}`);
			}
		});

		[loginEmail, loginPassword].forEach((el) => {
			el.addEventListener("keydown", (e) => {
				if (e.key === "Enter") loginBtn.click();
			});
		});
	}

	async function updatePasswordInSheet(email, oldPassword, newPassword) {
		const url = `${PASSWORD_UPDATE_SCRIPT_URL}?email=${encodeURIComponent(email)}&oldPassword=${encodeURIComponent(oldPassword)}&newPassword=${encodeURIComponent(newPassword)}`;
		try {
			await fetch(url, { method: "GET", mode: "no-cors" });

			showNotification("Password change request sent. Check your sheet.");
			return true;
		} catch (err) {
			showNotification("Network error: " + err.message);
			return false;
		}
	}

	let allTemplates = [];

	async function loadTroubleshootingTemplates() {
		const apiKey = getGoogleApiKey();
		if (!apiKey) {
			console.warn("No API key, cannot load templates");
			return;
		}
		try {
			const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.GOOGLE_SHEET_ID}/values/${encodeURIComponent(CONFIG.TEMPLATE_SHEET_NAME)}?key=${apiKey}`;
			const response = await fetch(url);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const data = await response.json();
			if (!data.values || data.values.length < 2) {
				allTemplates = [];
				updateTemplateDropdown();
				return;
			}

			allTemplates = [];
			for (let i = 1; i < data.values.length; i++) {
				const moduleName = (data.values[i][0] || "").trim();
				const title = (data.values[i][1] || "").trim();
				const steps = (data.values[i][2] || "").trim();
				if (title && steps) {
					allTemplates.push({
						module: moduleName,
						title: title,
						steps: steps,
					});
				}
			}
			updateTemplateDropdown();
		} catch (error) {
			console.error("Failed to load templates:", error);
			allTemplates = [];
			updateTemplateDropdown(true);
		}
	}

	function updateTemplateDropdown(showError = false) {
		const select = document.getElementById("ticket-template-select");
		if (!select) return;

		const moduleInput = document.getElementById("ticket-module");
		const selectedModule = moduleInput ? moduleInput.value.trim().toUpperCase() : "";

		let filtered = [];
		if (selectedModule !== "") {
			filtered = allTemplates.filter((t) => {
				const templateModule = t.module.toUpperCase();
				return templateModule === selectedModule || templateModule === "" || templateModule === "ALL";
			});
		}

		if (showError) {
			select.innerHTML = '<option value="">-- Error loading templates --</option>';
			select.disabled = true;
			return;
		}

		if (filtered.length === 0) {
			if (selectedModule === "") {
				select.innerHTML = '<option value="">-- Select a module first --</option>';
			} else {
				select.innerHTML = `<option value="">-- No templates for "${selectedModule}" --</option>`;
			}
			select.disabled = true;
			return;
		}

		select.disabled = false;
		select.innerHTML = '<option value="">-- Select a template --</option>';
		filtered.forEach((t) => {
			const option = document.createElement("option");
			option.value = t.steps;
			option.textContent = t.title;
			select.appendChild(option);
		});
	}

	function initTemplateSelector() {
		const templateSelect = document.getElementById("ticket-template-select");
		if (!templateSelect) return;

		templateSelect.addEventListener("change", async (e) => {
			const steps = e.target.value;
			if (!steps) return;

			const templateName = templateSelect.options[templateSelect.selectedIndex]?.text || "template";
			const confirmReplace = confirm(`Replace current troubleshooting steps with "${templateName}"?`);
			if (!confirmReplace) {
				templateSelect.value = "";
				return;
			}

			const collapsed = steps.replace(/[\r\n]+/g, "\n");
			const lines = collapsed.split("\n");
			const nonEmptyLines = lines.filter((line) => line.trim() !== "");
			const plainText = nonEmptyLines.join("\n");

			if (quillEditor) {
				quillEditor.setText(plainText);
				const htmlContent = quillEditor.root.innerHTML;
				document.getElementById("ticket-resolution").value = htmlContent;
				ticketUpdatePreview();
				showNotification(`Template "${templateName}" loaded. You can now edit as needed.`);
			}
			templateSelect.value = "";
		});
	}

	let isPendingTrackerMode = false;
	let cachedPendingEntries = [];

	async function fetchWorkloadSheetData() {
		const apiKey = getGoogleApiKey();
		if (!apiKey) {
			showNotification("❌ Google Sheets API key not set.");
			return [];
		}
		const sheetName = "WORKLOAD TRACKER 2026";
		const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.GOOGLE_SHEET_ID}/values/${encodeURIComponent(sheetName)}?key=${apiKey}`;
		try {
			const response = await fetch(url);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const data = await response.json();
			if (!data.values || data.values.length < 2) {
				showNotification("No data found in WORKLOAD TRACKER 2026");
				return [];
			}

			const headers = data.values[0].map((h) => (h || "").trim());
			console.log("📋 Headers from sheet:", headers);

			const findCol = (name) => headers.findIndex((h) => h.toUpperCase() === name.toUpperCase());

			const dateIdx = findCol("DATE");
			const shiftIdx = findCol("SHIFT SCHEDULE");
			const supportIdx = findCol("SUPPORT NAME");
			const portalIdx = findCol("PORTAL NUMBER");
			const storeIdx = findCol("STORE NAME");
			const zipIdx = findCol("ZIP CODE");
			const contactIdx = findCol("CONTACT PERSON");
			const contactNumIdx = findCol("CONTACT #");
			const moduleIdx = findCol("Module");
			const issueIdx = findCol("ISSUE");
			const escalatedIdx = findCol("ESCALATED PERSON");
			const statusIdx = findCol("STATUS");
			const remarksIdx = findCol("REMARKS");
			const resolutionIdx = findCol("RESOLUTION");

			if (statusIdx === -1 || supportIdx === -1) {
				console.error("Missing STATUS or SUPPORT NAME column. Found headers:", headers);
				showNotification("Sheet missing STATUS or SUPPORT NAME column.");
				return [];
			}

			const rows = data.values.slice(1);
			const currentUserSupport = (currentUser?.support || "").trim();
			console.log(`🔍 Current user support: "${currentUserSupport}"`);

			const pendingRows = rows.filter((row) => {
				const status = (row[statusIdx] || "").trim().toUpperCase();
				const support = (row[supportIdx] || "").trim().toUpperCase();
				return status === "PENDING" && support === currentUserSupport.toUpperCase();
			});

			console.log(`📊 Found ${pendingRows.length} pending tickets for "${currentUserSupport}"`);

			if (pendingRows.length === 0 && rows.length > 0) {
				console.log("Sample of first 3 rows (status, support):");
				rows.slice(0, 3).forEach((row, i) => {
					console.log(`  Row ${i + 1}: status="${row[statusIdx]}", support="${row[supportIdx]}"`);
				});
			}

			return pendingRows.map((row) => ({
				id: Date.now() + Math.random(),
				date: dateIdx !== -1 ? row[dateIdx] || "" : "",
				shift: shiftIdx !== -1 ? row[shiftIdx] || "" : "",
				support: supportIdx !== -1 ? row[supportIdx] || "" : "",
				portal: portalIdx !== -1 ? row[portalIdx] || "" : "",
				store: storeIdx !== -1 ? row[storeIdx] || "" : "",
				zip: zipIdx !== -1 ? row[zipIdx] || "" : "",
				contact: contactIdx !== -1 ? row[contactIdx] || "" : "",
				contactNumber: contactNumIdx !== -1 ? row[contactNumIdx] || "" : "",
				module: moduleIdx !== -1 ? row[moduleIdx] || "" : "",
				issue: issueIdx !== -1 ? row[issueIdx] || "" : "",
				escalated: escalatedIdx !== -1 ? row[escalatedIdx] || "" : "",
				status: statusIdx !== -1 ? row[statusIdx] || "" : "",
				remarks: remarksIdx !== -1 ? row[remarksIdx] || "" : "",
				resolution: resolutionIdx !== -1 ? row[resolutionIdx] || "" : "",
				troubleshooting: "",
				note: "",
				source: "workload",
				deleted: false,
				imported: false,
			}));
		} catch (err) {
			console.error("Failed to load workload sheet:", err);
			showNotification(`Error: ${err.message}`);
			return [];
		}
	}

	function renderPendingTableView(entries) {
		const tbody = document.querySelector("#entryTable tbody");
		tbody.innerHTML = "";
		if (!entries.length) {
			tbody.innerHTML = `<tr><td colspan="16" style="text-align:center;">✨ No pending tickets found for you in WORKLOAD TRACKER 2026 ✨</td></tr>`;
			return;
		}
		entries.forEach((entry) => {
			const row = document.createElement("tr");
			row.dataset.id = entry.id;
			row.innerHTML = `
                  <td><input type="checkbox" class="row-checkbox" value="${entry.id}"></td>
                  <td>${escapeHtml(entry.date)}</td>
                  <td>${escapeHtml(entry.shift)}</td>
                  <td>${escapeHtml(entry.support)}</td>
                  <td>${escapeHtml(entry.portal)}</td>
                  <td>${escapeHtml(entry.store)}</td>
                  <td>${escapeHtml(entry.zip)}</td>
                  <td>${escapeHtml(entry.contact)}</td>
                  <td>${escapeHtml(entry.contactNumber)}</td>
                  <td>${escapeHtml(entry.module)}</td>
                  <td style="white-space: pre-wrap;">${escapeHtml(entry.issue)}</td>
                  <td>${escapeHtml(entry.escalated)}</td>
                  <td>${escapeHtml(entry.status)}</td>
                  <td style="white-space: pre-wrap;">${escapeHtml(entry.remarks)}</td>
                  <td style="white-space: pre-wrap;">${escapeHtml(entry.resolution)}</td>
                  <td class="action-cell">
                      <div class="action-container">
                          <button class="icon-btn copy-btn" onclick="copyRow(this)" title="Copy"><i class="bi bi-clipboard-fill"></i></button>
                          <button class="icon-btn edit-btn disabled" disabled title="Edit not allowed in tracker view"><i class="bi bi-pencil-square"></i></button>
                          <button class="icon-btn delete-btn disabled" disabled title="Delete not allowed"><i class="bi bi-trash3-fill"></i></button>
                      </div>
                  </td>
              `;
			tbody.appendChild(row);
		});
		updateSelectAllCheckboxState();
	}

	async function togglePendingTracker() {
		isPendingTrackerMode = !isPendingTrackerMode;
		localStorage.setItem("pendingTrackerMode", isPendingTrackerMode ? "true" : "false");
		const toggleBtn = document.getElementById("pendingTrackerToggleBtn");
		if (isPendingTrackerMode) {
			toggleBtn.classList.add("active");
			toggleBtn.textContent = "SHOW LOCAL ENTRIES";
			showNotification("Loading your pending tickets from WORKLOAD TRACKER 2026...");
			const pendingEntries = await fetchWorkloadSheetData();
			cachedPendingEntries = pendingEntries;
			renderPendingTableView(pendingEntries);
			updateStatusCounters();
		} else {
			toggleBtn.classList.remove("active");
			toggleBtn.innerHTML = '<i class="icon-custom-smaller icon-google-sheets"></i> SHOW ALL PENDING';
			renderTable();
			updateStatusCounters();
			updateStatusCounters();
		}
	}

	function init() {
		const loggedInUser = getLoggedInUser();
		if (!loggedInUser) {
			document.getElementById("loginOverlay").style.display = "flex";
			document.querySelector(".app-container").style.display = "none";
			document.getElementById("entryTable").style.display = "none";
			document.querySelector(".bulk-bar").style.display = "none";
			setupLoginListeners();
			return;
		}

		document.getElementById("loginOverlay").style.display = "none";
		document.querySelector(".app-container").style.display = "";
		document.getElementById("entryTable").style.display = "";
		document.querySelector(".bulk-bar").style.display = "";

		applyRoleRestrictions(loggedInUser.role);

		autoFillSupportName(loggedInUser.support);
		window.currentUser = loggedInUser;

		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const yyyy = yesterday.getFullYear();
		const mm = String(yesterday.getMonth() + 1).padStart(2, "0");
		const dd = String(yesterday.getDate()).padStart(2, "0");
		const yesterdayStr = `${yyyy}-${mm}-${dd}`;
		document.getElementById("moolah-date").value = yesterdayStr;
		document.getElementById("store-date").value = yesterdayStr;
		document.getElementById("ticket-date").value = yesterdayStr;

		const savedTab = localStorage.getItem("activeTab") || "ticket";
		const tabButton = Array.from(document.querySelectorAll(".tab-button")).find((btn) => btn.textContent.trim().toLowerCase().includes(savedTab));
		if (tabButton) switchTab(savedTab, tabButton);

		loadFormData("moolah");
		loadFormData("store");
		loadFormData("ticket");

		autoFillSupportName(currentUser.support);
		syncShiftSupportFromTicket();
		loadAllEntries();
		updateStatusCounters();
		archiveOldEntries();
		saveAllEntries();

		["moolah", "store", "ticket"].forEach((prefix) => {
			setupSearchKeyboard(prefix);
		});

		if (getGoogleApiKey()) {
			setTimeout(loadSheetData, 500);
		} else {
			["ticket", "store", "moolah"].forEach((prefix) => {
				const statusEl = document.getElementById(`${prefix}-loadStatus`);
				if (statusEl) statusEl.innerHTML = '<span class="error">⚠️ API key not set. Click SET SHEETS KEY in bulk bar.</span>';
			});
		}

		document.querySelectorAll("textarea").forEach((ta) => autoGrow(ta));

		setupBootstrapDropdown("ticket-module", MODULE_OPTIONS, "ticket-issue");
		setupBootstrapDropdown("ticket-status", STATUS_OPTIONS, "ticket-remarks");
		setupBootstrapDropdown("ticket-shift", SHIFT_OPTIONS, "ticket-support");
		const moduleField = document.getElementById("ticket-module");
		if (moduleField) {
			moduleField.addEventListener("change", () => updateTemplateDropdown());
			moduleField.addEventListener("input", () => updateTemplateDropdown());
		}

		document.getElementById("ticket-contactNumber").addEventListener("input", function () {
			let v = this.value.replace(/\D/g, "");
			if (v.length > 0) v = "(" + v;
			if (v.length > 4) v = v.slice(0, 4) + ") " + v.slice(4);
			if (v.length > 9) v = v.slice(0, 9) + "-" + v.slice(9, 13);
			this.value = v.slice(0, 14);
			saveFormData("ticket");
		});

		document.getElementById("moolah-support").addEventListener("input", () => {
			saveFormData("moolah");
			moolahUpdatePreview();
		});
		document.getElementById("moolah-shift").addEventListener("change", () => saveFormData("moolah"));

		document.getElementById("store-support").addEventListener("input", () => {
			saveFormData("store");
			storeUpdatePreview();
		});
		document.getElementById("store-shift").addEventListener("change", () => saveFormData("store"));

		document.getElementById("ticket-support").addEventListener("input", () => {
			saveFormData("ticket");
			ticketUpdatePreview();
		});
		document.getElementById("ticket-shift").addEventListener("change", () => saveFormData("ticket"));

		document.getElementById("ticket-date").addEventListener("change", syncShiftSupportFromTicket);

		const moolahFields = ["portal", "storeName", "zipcode", "address1", "address2", "city", "state", "email", "password", "noOfTabs", "sku", "mokiId", "anydeskId"];
		moolahFields.forEach((id) => {
			const el = document.getElementById(`moolah-${id}`);
			if (el)
				el.addEventListener("input", () => {
					moolahUpdatePreview();
					saveFormData("moolah");
				});
		});

		const storeFields = ["portal", "storeName", "zipcode", "address1", "address2", "city", "state", "agent", "email", "password", "sku", "database", "noOfReg", "mokiId", "anydeskId"];
		storeFields.forEach((id) => {
			const el = document.getElementById(`store-${id}`);
			if (el)
				el.addEventListener("input", () => {
					storeUpdatePreview();
					saveFormData("store");
				});
		});

		const ticketFields = ["portal", "store", "zip", "contactPerson", "contactNumber", "issue", "escalated", "status", "remarks", "resolution", "note"];
		ticketFields.forEach((id) => {
			const el = document.getElementById(`ticket-${id}`);
			if (el)
				el.addEventListener("input", () => {
					ticketUpdatePreview();
					saveFormData("ticket");
				});
		});

		document.querySelectorAll('input:not([type="date"]):not([type="checkbox"]):not([type="radio"]):not(.no-uppercase), textarea:not(.no-uppercase)').forEach((el) => {
			if (el.id === "ticket-issue" || el.id === "ticket-remarks" || el.id === "ticket-resolution" || el.id === "ticket-note" || el.id === "oldPassword" || el.id === "newPassword" || el.id === "confirmPassword") {
				return;
			}
			el.addEventListener("input", function () {
				if (!this.value) return;
				const start = this.selectionStart;
				const end = this.selectionEnd;
				this.value = this.value.toUpperCase();
				this.setSelectionRange(start, end);
			});
			el.addEventListener("blur", function () {
				if (this.value) this.value = this.value.toUpperCase();
			});
		});

		initTheme();
		document.getElementById("themeToggle").addEventListener("click", toggleTheme);

		document.getElementById("bulkDeleteBtn").addEventListener("click", bulkDelete);
		document.getElementById("bulkCopyBtn").addEventListener("click", bulkCopy);
		document.getElementById("bulkUpdateStatusBtn").addEventListener("click", bulkUpdateStatus);
		document.getElementById("exportCsvBtn").addEventListener("click", exportToCSV);
		document.getElementById("manualRefreshBtn")?.addEventListener("click", () => {
			updateStatusCounters();
			showNotification("Counters refreshed");
		});

		const importBtn = document.getElementById("importCsvBtn");
		const fileInput = document.createElement("input");
		fileInput.type = "file";
		fileInput.accept = ".csv";
		fileInput.style.display = "none";
		fileInput.addEventListener("change", importFromCSV);
		document.body.appendChild(fileInput);
		importBtn.addEventListener("click", () => fileInput.click());

		document.getElementById("shiftReportBtn").addEventListener("click", showShiftReportModal);

		const selectAllBar = document.getElementById("selectAllCheckbox");
		selectAllBar.addEventListener("change", (e) => handleSelectAll(e.target));

		document.addEventListener("change", (e) => {
			if (e.target.classList.contains("row-checkbox")) {
				updateSelectAllCheckboxState();
			}
		});

		document.addEventListener("keydown", (e) => {
			if (e.ctrlKey && e.key === "z") {
				e.preventDefault();
				undo();
			} else if (e.ctrlKey && e.key === "y") {
				e.preventDefault();
				redo();
			}
		});

		window.addEventListener("resize", syncPreviewHeight);

		document.getElementById("ticket-shift").addEventListener("change", syncShiftSupportFromTicket);
		document.getElementById("ticket-support").addEventListener("input", syncShiftSupportFromTicket);

		if (!localStorage.getItem("lastClearDate")) {
			localStorage.setItem("lastClearDate", getESTDateString());
		}
		setInterval(checkAndRefreshTable, 60000);

		loadCollapseState();

		quillEditor = new Quill("#ticket-resolution-editor", {
			theme: "snow",
			modules: {
				toolbar: [["bold", "italic", "underline", "strike"], [{ list: "ordered" }, { list: "bullet" }], ["clean"]],
			},
		});

		loadTroubleshootingTemplates();
		initTemplateSelector();

		if (quillEditor && document.getElementById("ticket-resolution").value) {
			quillEditor.root.innerHTML = document.getElementById("ticket-resolution").value;
		}

		quillEditor.on("text-change", function (delta, oldDelta, source) {
			const htmlContent = quillEditor.root.innerHTML;
			document.getElementById("ticket-resolution").value = htmlContent;
			ticketUpdatePreview();
			saveFormData("ticket");
		});

		window.storeSteps = {
			form: "done",
			creation: "done",
			install: "done",
			upload: "pending",
		};
		window.moolahSteps = {
			create: "done",
			install: "done",
			assign: "done",
		};

		function updateStoreIssuePreview() {
			const steps = {
				form: "NEW STORE CREATION FORM SENT",
				creation: "STORE CREATION",
				install: "INSTALL, UPDATE APPS & LOGIN ACCOUNT",
				upload: "UPLOAD DATABASE",
			};
			let lines = [];
			for (let [key, label] of Object.entries(steps)) {
				const status = window.storeSteps[key] === "done" ? "DONE ✅" : "PENDING ❌";
				lines.push(`${label} - ${status}`);
			}
			const issueText = lines.join("\n");
			const el = document.getElementById("store-generated-issue");
			if (el) el.innerText = issueText;
			window._storeCurrentIssue = issueText;
		}

		function updateMoolahIssuePreview() {
			const steps = {
				create: "CREATE MOOLAH ACCOUNT",
				install: "INSTALL & UPDATE ALL APPS",
				assign: "ASSIGN STORE",
			};
			let lines = [];
			for (let [key, label] of Object.entries(steps)) {
				const status = window.moolahSteps[key] === "done" ? "DONE ✅" : "PENDING ❌";
				lines.push(`${label} - ${status}`);
			}
			const issueText = lines.join("\n");
			const el = document.getElementById("moolah-generated-issue");
			if (el) el.innerText = issueText;
			window._moolahCurrentIssue = issueText;
		}

		const STORE_STEP_LABELS = {
			form: "NEW STORE CREATION FORM SENT",
			creation: "STORE CREATION",
			install: "INSTALL, UPDATE APPS & LOGIN ACCOUNT",
			upload: "UPLOAD DATABASE",
		};

		const MOOLAH_STEP_LABELS = {
			create: "CREATE MOOLAH ACCOUNT",
			install: "INSTALL & UPDATE ALL APPS",
			assign: "ASSIGN STORE",
		};

		function parseStepStatusesFromIssue(issueText, stepLabels, currentSteps) {
			const result = { ...currentSteps };
			if (!issueText) return result;
			const lines = issueText
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter((line) => line.length > 0);
			lines.forEach((line) => {
				for (const [step, label] of Object.entries(stepLabels)) {
					if (!line.toLowerCase().includes(label.toLowerCase())) continue;
					if (/\bdone\b/i.test(line)) {
						result[step] = "done";
					} else if (/\bpending\b/i.test(line)) {
						result[step] = "pending";
					}
				}
			});
			return result;
		}

		function applyStepButtonStyles(prefix, steps) {
			document.querySelectorAll(`.${prefix}-step-btn`).forEach((btn) => {
				const step = btn.dataset.step;
				if (!step || !steps[step]) return;
				if (btn.dataset.status === steps[step]) {
					btn.style.backgroundColor = steps[step] === "done" ? "#198754" : "#dc3545";
					btn.style.color = "white";
					btn.style.borderColor = "";
				} else {
					btn.style.backgroundColor = "";
					btn.style.color = "";
					btn.style.borderColor = "";
				}
			});
		}

		function initStoreStepButtons() {
			document.querySelectorAll(".store-step-btn").forEach((btn) => {
				btn.addEventListener("click", () => {
					const step = btn.dataset.step;
					const status = btn.dataset.status;
					window.storeSteps[step] = status;
					applyStepButtonStyles("store", window.storeSteps);
					updateStoreIssuePreview();
				});
			});
		}

		function initMoolahStepButtons() {
			document.querySelectorAll(".moolah-step-btn").forEach((btn) => {
				btn.addEventListener("click", () => {
					const step = btn.dataset.step;
					const status = btn.dataset.status;
					window.moolahSteps[step] = status;
					applyStepButtonStyles("moolah", window.moolahSteps);
					updateMoolahIssuePreview();
				});
			});
		}

		function syncStoreButtonsFromIssueText(issueText) {
			window.storeSteps = parseStepStatusesFromIssue(issueText, STORE_STEP_LABELS, window.storeSteps);
			applyStepButtonStyles("store", window.storeSteps);
		}

		function syncMoolahButtonsFromIssueText(issueText) {
			window.moolahSteps = parseStepStatusesFromIssue(issueText, MOOLAH_STEP_LABELS, window.moolahSteps);
			applyStepButtonStyles("moolah", window.moolahSteps);
		}

		initStoreStepButtons();
		initMoolahStepButtons();
		syncStoreButtonsFromIssueText(document.getElementById("store-generated-issue")?.innerText || "");
		syncMoolahButtonsFromIssueText(document.getElementById("moolah-generated-issue")?.innerText || "");
		updateStoreIssuePreview();
		updateMoolahIssuePreview();

		const profileBtn = document.getElementById("profileBtn");
		const profileModal = document.getElementById("profileModal");
		const closeProfile = document.getElementById("closeProfileModal");
		const changePwdBtn = document.getElementById("changePasswordBtn");
		const logoutProfileBtn = document.getElementById("logoutBtnProfile");

		function showProfileModal() {
			document.getElementById("profileSupport").textContent = currentUser.support || "";
			document.getElementById("profileEmail").textContent = currentUser.email || "";
			document.getElementById("profileRole").textContent = currentUser.role || "";
			profileModal.style.display = "block";
		}
		profileBtn.addEventListener("click", showProfileModal);
		closeProfile.addEventListener("click", () => (profileModal.style.display = "none"));
		window.addEventListener("click", (e) => {
			if (e.target === profileModal) profileModal.style.display = "none";
		});

		logoutProfileBtn.addEventListener("click", () => {
			if (confirm("Logout?")) {
				localStorage.removeItem("moolahFormData");
				localStorage.removeItem("storeFormData");
				localStorage.removeItem("ticketFormData");
				clearLoggedInUser();
				location.reload();
			}
		});

		const changePwdModal = document.getElementById("changePwdModal");
		const backdrop = document.getElementById("pwdModalBackdrop");
		changePwdBtn.addEventListener("click", () => {
			changePwdModal.style.display = "block";
			backdrop.style.display = "block";
		});
		document.getElementById("cancelPwdChange").addEventListener("click", () => {
			changePwdModal.style.display = "none";
			backdrop.style.display = "none";
			document.getElementById("pwdError").textContent = "";
			document.getElementById("oldPassword").value = "";
			document.getElementById("newPassword").value = "";
			document.getElementById("confirmPassword").value = "";
		});
		backdrop.addEventListener("click", () => {
			changePwdModal.style.display = "none";
			backdrop.style.display = "none";
		});

		document.querySelectorAll(".togglePwd").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				const targetId = btn.getAttribute("data-target");
				const input = document.getElementById(targetId);
				if (input.type === "password") {
					input.type = "text";
					btn.textContent = "🙈";
				} else {
					input.type = "password";
					btn.textContent = "🙉";
				}
			});
		});

		document.getElementById("submitPasswordChange").addEventListener("click", async () => {
			const oldPwd = document.getElementById("oldPassword").value;
			const newPwd = document.getElementById("newPassword").value;
			const confirmPwd = document.getElementById("confirmPassword").value;
			const errorDiv = document.getElementById("pwdError");
			errorDiv.textContent = "";

			if (!oldPwd || !newPwd || !confirmPwd) {
				errorDiv.textContent = "All fields required.";
				return;
			}
			if (newPwd !== confirmPwd) {
				errorDiv.textContent = "New passwords do not match.";
				return;
			}
			if (newPwd.length < 4) {
				errorDiv.textContent = "Password must be at least 4 characters.";
				return;
			}

			const email = currentUser.email;
			const success = await updatePasswordInSheet(email, oldPwd, newPwd);
			if (success) {
				changePwdModal.style.display = "none";
				backdrop.style.display = "none";
				showNotification("Password updated successfully. Please login again.");
				setTimeout(() => {
					clearLoggedInUser();
					location.reload();
				}, 1500);
			} else {
				errorDiv.textContent = "Failed to update password. Old password may be incorrect or script error.";
			}
		});

		const savedMode = localStorage.getItem("pendingTrackerMode");
		if (savedMode === "true" && currentUser) {
			isPendingTrackerMode = true;
			const toggleBtn = document.getElementById("pendingTrackerToggleBtn");
			if (toggleBtn) {
				toggleBtn.classList.add("active");
				toggleBtn.textContent = "🔙 Back to Local DB";

				fetchWorkloadSheetData().then((entries) => {
					cachedPendingEntries = entries;
					renderPendingTableView(entries);
				});
			}
		} else {
			localStorage.setItem("pendingTrackerMode", "false");
		}
		document.getElementById("pendingTrackerToggleBtn").addEventListener("click", togglePendingTracker);

		const IDLE_REFRESH_DELAY = 900000;
		let idleTimeout;
		function idleReload() {
			window.location.reload();
		}
		function resetIdleTimer() {
			if (idleTimeout) clearTimeout(idleTimeout);
			idleTimeout = setTimeout(idleReload, IDLE_REFRESH_DELAY);
		}
		const activityEvents = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click", "focusin", "input"];
		activityEvents.forEach((eventName) => {
			window.addEventListener(eventName, resetIdleTimer, {
				passive: true,
			});
		});
		resetIdleTimer();

		let refreshInterval = null;

		function startCounterRefresh() {
			if (refreshInterval) clearInterval(refreshInterval);
			refreshInterval = setInterval(() => {
				updateStatusCounters();
			}, 30000);
		}

		function stopCounterRefresh() {
			if (refreshInterval) {
				clearInterval(refreshInterval);
				refreshInterval = null;
			}
		}

		startCounterRefresh();

		const originalLogout = logoutProfileBtn.onclick;
		logoutProfileBtn.addEventListener("click", () => {
			stopCounterRefresh();
		});
	}

	window.switchTab = switchTab;
	window.clock = clock;
	window.addEntry = addEntry;
	window.clearFormOnly = clearFormOnly;
	window.editEntry = editEntry;
	window.softDeleteEntry = softDeleteEntry;
	window.copyRow = copyRow;
	window.selectStore = selectStore;
	window.highlightResult = highlightResult;
	window.summarizeEntryResolution = summarizeEntryResolution;

	document.addEventListener("DOMContentLoaded", init);
})();
