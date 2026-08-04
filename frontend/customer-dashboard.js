const STORAGE = {
    profile: "localConnectProfile",
    user: "localConnectUser",
    addresses: "localConnectAddresses",
    legacyAddress: "localConnectSavedAddress",
    bookings: "localConnectBookings",
    favourites: "localConnectFavourites",
    settings: "localConnectSettings",
    theme: "localConnectTheme"
};

const activeStatuses = new Set(["requested", "confirmed", "accepted", "scheduled", "on the way", "in progress"]);
const views = [...document.querySelectorAll("[data-panel]")];
const navButtons = [...document.querySelectorAll(".account-nav [data-view]")];
const profileForm = document.getElementById("profile-form");
const addressDialog = document.getElementById("address-dialog");
const addressForm = document.getElementById("address-form");
const bookingDialog = document.getElementById("booking-dialog");
const rescheduleDialog = document.getElementById("reschedule-dialog");
const rescheduleForm = document.getElementById("reschedule-form");
const toast = document.getElementById("toast");
let toastTimer;

function readStorage(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key));
        return value ?? fallback;
    } catch {
        return fallback;
    }
}

function writeStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
    const node = document.createElement("span");
    node.textContent = String(value ?? "");
    return node.innerHTML;
}

function initials(name, email = "") {
    const words = String(name || email || "User").trim().split(/\s+/).filter(Boolean);
    return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0]?.slice(0, 2) || "U").toUpperCase();
}

function notify(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function getProfile() {
    return readStorage(STORAGE.profile, {
        name: localStorage.getItem(STORAGE.user) || "Customer",
        email: "",
        phone: "",
        dateOfBirth: "",
        language: "English"
    });
}

function getAddresses() {
    let addresses = readStorage(STORAGE.addresses, []);
    if (!addresses.length) {
        const legacy = readStorage(STORAGE.legacyAddress, null);
        if (legacy) {
            addresses = [{ ...legacy, id: `address-${Date.now()}`, label: legacy.addressLabel || legacy.label || "Home" }];
            writeStorage(STORAGE.addresses, addresses);
        }
    }
    return addresses;
}

function getBookings() {
    return readStorage(STORAGE.bookings, []).map(booking => ({ ...booking, status: booking.status || "Requested" }));
}

function getFavourites() {
    return readStorage(STORAGE.favourites, []);
}

function emptyState(icon, title, copy, linkText = "", href = "home.html#categories") {
    return `<div class="empty-state"><span>${icon}</span><strong>${title}</strong><p>${copy}</p>${linkText ? `<a class="primary-button" href="${href}">${linkText}</a>` : ""}</div>`;
}

function showView(name, updateHash = true) {
    const validName = views.some(view => view.dataset.panel === name) ? name : "overview";
    views.forEach(view => {
        const active = view.dataset.panel === validName;
        view.hidden = !active;
        view.classList.toggle("active", active);
    });
    navButtons.forEach(button => button.classList.toggle("active", button.dataset.view === validName));
    if (updateHash) history.replaceState(null, "", `#${validName}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
    renderAll();
}

document.querySelectorAll("[data-view], [data-view-link]").forEach(button => {
    button.addEventListener("click", () => showView(button.dataset.view || button.dataset.viewLink));
});

function renderIdentity() {
    const profile = getProfile();
    const avatarText = initials(profile.name, profile.email);
    document.getElementById("sidebar-avatar").textContent = avatarText;
    document.getElementById("profile-avatar").textContent = avatarText;
    document.getElementById("sidebar-name").textContent = profile.name || "Customer";
    document.getElementById("sidebar-email").textContent = profile.email || "Complete your profile";
    document.getElementById("welcome-name").textContent = String(profile.name || "Customer").split(" ")[0];
}

function statusClass(status) {
    const normalized = String(status).toLowerCase();
    if (normalized === "completed") return "completed";
    if (normalized === "cancelled") return "cancelled";
    return "";
}

function formatDate(value) {
    if (!value) return "Date to be confirmed";
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function bookingCard(booking) {
    const id = escapeHtml(booking.id || "Pending ID");
    const service = escapeHtml(booking.service || booking.serviceType || "Home service");
    const provider = escapeHtml(booking.provider || "Professional to be assigned");
    const status = escapeHtml(booking.status);
    const active = activeStatuses.has(String(booking.status).toLowerCase());
    return `<article class="booking-card"><span class="booking-icon">⌂</span><div class="booking-copy"><h2>${service}</h2><p>${provider} · ${id}</p><small>${formatDate(booking.date)} · ${escapeHtml(booking.time || "Time to be confirmed")}</small></div><div class="booking-side"><span class="status ${statusClass(booking.status)}">${status}</span><div class="booking-actions">${active ? `<button data-reschedule="${id}">Reschedule</button>` : ""}<button class="primary-small" data-booking-detail="${id}">View details</button></div></div></article>`;
}

function renderOverview(bookings, addresses, favourites) {
    const active = bookings.filter(item => activeStatuses.has(String(item.status).toLowerCase()));
    const completed = bookings.filter(item => String(item.status).toLowerCase() === "completed");
    document.getElementById("summary-active").textContent = active.length;
    document.getElementById("summary-completed").textContent = completed.length;
    document.getElementById("summary-favourites").textContent = favourites.length;
    document.getElementById("summary-addresses").textContent = addresses.length;
    document.getElementById("active-count").textContent = active.length;
    document.getElementById("overview-booking").innerHTML = active.length ? bookingCard(active[0]) : emptyState("◷", "No active bookings", "Your next confirmed service will appear here.", "Find a service");
}

function renderProfileForm() {
    const profile = getProfile();
    [...profileForm.elements].forEach(input => {
        if (input.name && profile[input.name] !== undefined) input.value = profile[input.name];
    });
}

profileForm.addEventListener("submit", event => {
    event.preventDefault();
    if (!profileForm.reportValidity()) return;
    const profile = Object.fromEntries(new FormData(profileForm).entries());
    writeStorage(STORAGE.profile, profile);
    localStorage.setItem(STORAGE.user, profile.name);
    renderIdentity();
    document.getElementById("profile-message").textContent = "Profile saved successfully.";
    notify("Profile updated");
});

profileForm.addEventListener("reset", () => setTimeout(renderProfileForm));

function addressText(address) {
    return [address.street, address.area, address.city, address.state, address.pin].filter(Boolean).join(", ");
}

function renderAddresses(addresses) {
    const list = document.getElementById("address-list");
    if (!addresses.length) {
        list.innerHTML = emptyState("⌖", "No saved addresses", "Add an address to make future bookings faster.");
        return;
    }
    list.innerHTML = addresses.map(address => `<article class="address-card"><header><span>${escapeHtml(address.label || "Address")}</span><div class="card-menu"><button data-edit-address="${escapeHtml(address.id)}" aria-label="Edit ${escapeHtml(address.label)}">✎</button><button data-delete-address="${escapeHtml(address.id)}" aria-label="Delete ${escapeHtml(address.label)}">×</button></div></header><h2>${escapeHtml(address.customerName || "Service address")}</h2><p>${escapeHtml(addressText(address))}${address.landmark ? `<br>Near ${escapeHtml(address.landmark)}` : ""}</p></article>`).join("");
}

function openAddress(address = null) {
    addressForm.reset();
    document.getElementById("address-dialog-title").textContent = address ? "Edit address" : "Add address";
    addressForm.elements.id.value = address?.id || "";
    if (address) Object.entries(address).forEach(([key, value]) => { if (addressForm.elements[key]) addressForm.elements[key].value = value; });
    addressDialog.showModal();
}

document.getElementById("add-address").addEventListener("click", () => openAddress());
addressForm.addEventListener("submit", event => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    if (!addressForm.reportValidity()) return;
    const address = Object.fromEntries(new FormData(addressForm).entries());
    const addresses = getAddresses();
    address.id = address.id || `address-${Date.now()}`;
    const index = addresses.findIndex(item => item.id === address.id);
    if (index >= 0) addresses[index] = address; else addresses.unshift(address);
    writeStorage(STORAGE.addresses, addresses);
    addressDialog.close();
    renderAll();
    notify(index >= 0 ? "Address updated" : "Address added");
});

document.getElementById("address-list").addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-address]");
    const remove = event.target.closest("[data-delete-address]");
    if (edit) openAddress(getAddresses().find(address => address.id === edit.dataset.editAddress));
    if (remove && confirm("Delete this saved address?")) {
        writeStorage(STORAGE.addresses, getAddresses().filter(address => address.id !== remove.dataset.deleteAddress));
        renderAll();
        notify("Address deleted");
    }
});

function renderBookings(bookings) {
    const active = bookings.filter(item => activeStatuses.has(String(item.status).toLowerCase()));
    const historyItems = bookings.filter(item => !activeStatuses.has(String(item.status).toLowerCase()));
    document.getElementById("active-booking-list").innerHTML = active.length ? active.map(bookingCard).join("") : emptyState("◷", "No active bookings", "Book a trusted professional and track the service here.", "Browse services");
    renderHistory(historyItems);
}

function renderHistory(historyItems = getBookings().filter(item => !activeStatuses.has(String(item.status).toLowerCase()))) {
    const term = document.getElementById("history-search").value.trim().toLowerCase();
    const filter = document.getElementById("history-filter").value;
    const visible = historyItems.filter(item => {
        const matchesTerm = !term || `${item.service} ${item.provider} ${item.id}`.toLowerCase().includes(term);
        const matchesStatus = filter === "all" || String(item.status).toLowerCase() === filter;
        return matchesTerm && matchesStatus;
    });
    document.getElementById("history-list").innerHTML = visible.length ? visible.map(bookingCard).join("") : emptyState("✓", "No matching history", "Completed and cancelled services will appear here.");
}

document.getElementById("history-search").addEventListener("input", () => renderHistory());
document.getElementById("history-filter").addEventListener("change", () => renderHistory());

function timelineSteps(booking) {
    const status = String(booking.status).toLowerCase();
    const levels = { requested: 1, confirmed: 2, accepted: 2, scheduled: 2, "on the way": 3, "in progress": 4, completed: 5, cancelled: 1 };
    const current = levels[status] || 1;
    const steps = [["Request received", "We received your booking"], ["Booking confirmed", "The professional confirms the appointment"], ["Professional on the way", "Live arrival updates become available"], ["Service in progress", "Work has started at your address"], ["Service completed", "Receipt and review become available"]];
    if (status === "cancelled") return `<ol><li class="done"><strong>Request received</strong><small>${formatDate(booking.date)}</small></li><li class="done"><strong>Booking cancelled</strong><small>${escapeHtml(booking.cancelReason || "Cancelled by customer")}</small></li></ol>`;
    return `<ol>${steps.map((step, index) => `<li class="${index < current ? "done" : ""}"><strong>${step[0]}</strong><small>${step[1]}</small></li>`).join("")}</ol>`;
}

function openBooking(id) {
    const booking = getBookings().find(item => item.id === id);
    if (!booking) return;
    const active = activeStatuses.has(String(booking.status).toLowerCase());
    document.getElementById("booking-detail-title").textContent = booking.id || "Booking details";
    document.getElementById("booking-detail-content").innerHTML = `<div class="detail-summary"><div><h3>${escapeHtml(booking.service || "Home service")}</h3><p>${escapeHtml(booking.provider || "Professional to be assigned")}</p></div><span class="status ${statusClass(booking.status)}">${escapeHtml(booking.status)}</span></div><div class="detail-grid"><div><small>Date and time</small><strong>${formatDate(booking.date)}<br>${escapeHtml(booking.time || "To be confirmed")}</strong></div><div><small>Service address</small><strong>${escapeHtml(booking.address || "Address not available")}</strong></div><div><small>Estimated total</small><strong>${booking.total ? `₹${Number(booking.total).toLocaleString("en-IN")}` : escapeHtml(booking.price || "To be confirmed")}</strong></div><div><small>Payment</small><strong>${escapeHtml(booking.payment || "Not selected")}</strong></div></div><section class="timeline"><h3>Booking timeline</h3>${timelineSteps(booking)}</section><div class="detail-actions">${active ? `<button class="danger-button" data-cancel-booking="${escapeHtml(booking.id)}">Cancel booking</button><button class="primary-button" data-reschedule="${escapeHtml(booking.id)}">Reschedule</button>` : ""}</div>`;
    bookingDialog.showModal();
}

function openReschedule(id) {
    const booking = getBookings().find(item => item.id === id);
    if (!booking) return;
    rescheduleForm.elements.bookingId.value = id;
    rescheduleForm.elements.date.min = new Date().toISOString().slice(0, 10);
    rescheduleForm.elements.date.value = booking.date || rescheduleForm.elements.date.min;
    rescheduleForm.elements.time.value = booking.time || "";
    bookingDialog.close();
    rescheduleDialog.showModal();
}

document.addEventListener("click", event => {
    const detail = event.target.closest("[data-booking-detail]");
    const reschedule = event.target.closest("[data-reschedule]");
    const cancel = event.target.closest("[data-cancel-booking]");
    if (detail) openBooking(detail.dataset.bookingDetail);
    if (reschedule) openReschedule(reschedule.dataset.reschedule);
    if (cancel) cancelBooking(cancel.dataset.cancelBooking);
});

document.getElementById("close-booking").addEventListener("click", () => bookingDialog.close());
rescheduleForm.addEventListener("submit", event => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    if (!rescheduleForm.reportValidity()) return;
    const values = Object.fromEntries(new FormData(rescheduleForm).entries());
    const bookings = getBookings();
    const booking = bookings.find(item => item.id === values.bookingId);
    if (!booking) return;
    booking.date = values.date;
    booking.time = values.time;
    booking.status = "Scheduled";
    booking.rescheduledAt = new Date().toISOString();
    writeStorage(STORAGE.bookings, bookings);
    rescheduleDialog.close();
    renderAll();
    notify("Booking rescheduled");
});

function cancelBooking(id) {
    const reason = prompt("Why are you cancelling this booking?", "Plans changed");
    if (reason === null) return;
    const bookings = getBookings();
    const booking = bookings.find(item => item.id === id);
    if (!booking) return;
    booking.status = "Cancelled";
    booking.cancelReason = reason.trim() || "Cancelled by customer";
    booking.cancelledAt = new Date().toISOString();
    writeStorage(STORAGE.bookings, bookings);
    bookingDialog.close();
    renderAll();
    notify("Booking cancelled");
}

function renderFavourites(favourites) {
    const list = document.getElementById("favourite-list");
    if (!favourites.length) {
        list.innerHTML = emptyState("♡", "No favourite professionals", "Save professionals from the home page to find them here.", "Find professionals", "home.html#service-professionals");
        return;
    }
    list.innerHTML = favourites.map(item => `<article class="favourite-card"><img src="${escapeHtml(item.image || "assets/services/plumber.png")}" alt=""><div><h2>${escapeHtml(item.name)}</h2><p>${escapeHtml(item.type || "Local service professional")}</p><strong>${escapeHtml(item.rating || "Verified professional")}</strong></div><footer><button data-remove-favourite="${escapeHtml(item.id)}">Remove</button><a href="home.html?service=${encodeURIComponent(item.service || "")}">Book now</a></footer></article>`).join("");
}

document.getElementById("favourite-list").addEventListener("click", event => {
    const button = event.target.closest("[data-remove-favourite]");
    if (!button) return;
    writeStorage(STORAGE.favourites, getFavourites().filter(item => item.id !== button.dataset.removeFavourite));
    renderAll();
    notify("Removed from favourites");
});

function renderSettings() {
    const settings = readStorage(STORAGE.settings, { bookingUpdates: true, offers: false, emailReceipts: true, theme: "system", reminder: "60" });
    [...document.getElementById("settings-form").elements].forEach(input => {
        if (!input.name || settings[input.name] === undefined) return;
        if (input.type === "checkbox") input.checked = Boolean(settings[input.name]); else input.value = settings[input.name];
    });
}

document.getElementById("settings-form").addEventListener("submit", event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    form.querySelectorAll('input[type="checkbox"]').forEach(input => { data[input.name] = input.checked; });
    writeStorage(STORAGE.settings, data);
    if (data.theme === "night") localStorage.setItem(STORAGE.theme, "night");
    if (data.theme === "light") localStorage.setItem(STORAGE.theme, "day");
    document.getElementById("settings-message").textContent = "Settings saved.";
    notify("Settings saved");
});

function logout() {
    localStorage.removeItem(STORAGE.user);
    localStorage.removeItem(STORAGE.profile);
    sessionStorage.removeItem("localConnectBookingDraft");
    window.location.href = "index.html";
}

document.querySelectorAll("[data-logout]").forEach(button => button.addEventListener("click", () => {
    if (confirm("Log out of LocalConnect on this device?")) logout();
}));

document.getElementById("delete-local-data").addEventListener("click", () => {
    if (!confirm("Delete your locally stored profile, addresses, bookings, favourites and settings? This cannot be undone.")) return;
    Object.values(STORAGE).forEach(key => localStorage.removeItem(key));
    sessionStorage.clear();
    window.location.href = "index.html";
});

function renderAll() {
    const bookings = getBookings();
    const addresses = getAddresses();
    const favourites = getFavourites();
    renderIdentity();
    renderOverview(bookings, addresses, favourites);
    renderProfileForm();
    renderAddresses(addresses);
    renderBookings(bookings);
    renderFavourites(favourites);
    renderSettings();
}

window.addEventListener("hashchange", () => showView(location.hash.slice(1), false));
showView(location.hash.slice(1) || "overview", false);
