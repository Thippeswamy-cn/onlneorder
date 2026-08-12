const STORAGE = {
    profile: "localConnectWorkerProfile",
    requests: "localConnectWorkerRequests",
    jobs: "localConnectWorkerJobs",
    availability: "localConnectWorkerAvailability"
};

const defaultRequests = [
    { id: "LC-2408", service: "Fan installation", customer: "Megha Patil", area: "Vidyanagar", time: "Today, 11:00 AM - 01:00 PM", pay: 650, status: "Requested" },
    { id: "LC-2411", service: "Switchboard repair", customer: "Ravi H.", area: "MCC B Block", time: "Today, 02:00 PM - 04:00 PM", pay: 480, status: "Requested" },
    { id: "LC-2416", service: "Emergency wiring check", customer: "Ananya Rao", area: "PJ Extension", time: "Today, 04:00 PM - 06:00 PM", pay: 900, status: "Requested" }
];

const defaultJobs = [
    { id: "LC-2399", service: "Ceiling light fitting", customer: "Naveen S.", area: "Davanagere University Road", time: "Today, 09:00 AM - 11:00 AM", pay: 720, status: "Accepted" },
    { id: "LC-2388", service: "MCB inspection", customer: "Priya K.", area: "KB Extension", time: "Yesterday, 05:00 PM", pay: 540, status: "Completed" }
];

const views = [...document.querySelectorAll("[data-panel]")];
const navButtons = [...document.querySelectorAll(".worker-nav [data-view]")];
const profileForm = document.getElementById("worker-profile-form");
const availabilityToggle = document.getElementById("availability-toggle");
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

function money(value) {
    return `Rs ${Number(value || 0).toLocaleString("en-IN")}`;
}

function initials(name) {
    const words = String(name || "Worker").trim().split(/\s+/).filter(Boolean);
    return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0]?.slice(0, 2) || "W").toUpperCase();
}

function notify(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function getProfile() {
    return readStorage(STORAGE.profile, {
        name: "Suresh Kumar",
        trade: "Electrical specialist",
        phone: "+91 98765 43210",
        area: "Davangere",
        bio: "Certified local electrician for home wiring, fans, lights and safety checks."
    });
}

function getRequests() {
    return readStorage(STORAGE.requests, defaultRequests);
}

function getJobs() {
    return readStorage(STORAGE.jobs, defaultJobs);
}

function statusClass(status) {
    return String(status).toLowerCase().replace(/\s+/g, "-");
}

function emptyState(title, copy) {
    return `<div class="empty-state"><strong>${title}</strong><p>${copy}</p></div>`;
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

function jobCard(job, type) {
    const id = escapeHtml(job.id);
    const actions = type === "request"
        ? `<button data-decline="${id}">Decline</button><button class="primary-small" data-accept="${id}">Accept</button>`
        : `<button data-update="${id}">${job.status === "Completed" ? "Receipt" : "Update status"}</button><button class="primary-small" data-call="${id}">Call customer</button>`;
    return `<article class="job-card"><span class="job-icon">${type === "request" ? "NEW" : "JOB"}</span><div class="job-copy"><h2>${escapeHtml(job.service)}</h2><p>${escapeHtml(job.customer)} - ${escapeHtml(job.area)} - ${id}</p><small>${escapeHtml(job.time)} - ${money(job.pay)}</small></div><div class="job-side"><span class="status ${statusClass(job.status)}">${escapeHtml(job.status)}</span><div class="job-actions">${actions}</div></div></article>`;
}

function renderIdentity() {
    const profile = getProfile();
    const avatar = initials(profile.name);
    document.getElementById("worker-avatar").textContent = avatar;
    document.getElementById("profile-avatar").textContent = avatar;
    document.getElementById("worker-name").textContent = profile.name;
    document.getElementById("worker-trade").textContent = profile.trade;
    [...profileForm.elements].forEach(input => {
        if (input.name && profile[input.name] !== undefined) input.value = profile[input.name];
    });
}

function renderOverview(requests, jobs) {
    const activeJobs = jobs.filter(job => job.status !== "Completed");
    const todayEarnings = jobs.filter(job => job.status === "Completed").reduce((sum, job) => sum + Number(job.pay || 0), 0);
    document.getElementById("request-count").textContent = requests.length;
    document.getElementById("summary-requests").textContent = requests.length;
    document.getElementById("summary-active").textContent = activeJobs.length;
    document.getElementById("summary-earnings").textContent = money(todayEarnings);
    document.getElementById("current-job").innerHTML = activeJobs.length ? jobCard(activeJobs[0], "job") : emptyState("No active job", "Accepted work will appear here when your day starts.");
}

function renderRequests(requests) {
    document.getElementById("request-list").innerHTML = requests.length ? requests.map(job => jobCard(job, "request")).join("") : emptyState("No new requests", "New nearby booking requests will appear here.");
}

function renderJobs(jobs) {
    document.getElementById("job-list").innerHTML = jobs.length ? jobs.map(job => jobCard(job, "job")).join("") : emptyState("No jobs yet", "Accepted bookings are stored here.");
}

function renderEarnings(jobs) {
    const completed = jobs.filter(job => job.status === "Completed");
    const weekly = completed.reduce((sum, job) => sum + Number(job.pay || 0), 0) + 2450;
    document.getElementById("week-earnings").textContent = money(weekly);
    document.getElementById("payment-list").innerHTML = completed.length
        ? completed.map(job => `<div class="payment-row"><span>${escapeHtml(job.id)}</span><p>${escapeHtml(job.service)}</p><strong>${money(job.pay)}</strong></div>`).join("")
        : emptyState("No completed payments", "Payments appear after jobs are completed.");
}

function renderAvailability() {
    const online = readStorage(STORAGE.availability, true);
    availabilityToggle.classList.toggle("is-online", online);
    availabilityToggle.setAttribute("aria-pressed", String(online));
    availabilityToggle.lastChild.textContent = online ? "Online" : "Offline";
}

function renderAll() {
    const requests = getRequests();
    const jobs = getJobs();
    renderIdentity();
    renderOverview(requests, jobs);
    renderRequests(requests);
    renderJobs(jobs);
    renderEarnings(jobs);
    renderAvailability();
}

document.querySelectorAll("[data-view], [data-view-link]").forEach(button => {
    button.addEventListener("click", () => showView(button.dataset.view || button.dataset.viewLink));
});

document.addEventListener("click", event => {
    const accept = event.target.closest("[data-accept]");
    const decline = event.target.closest("[data-decline]");
    const update = event.target.closest("[data-update]");
    const call = event.target.closest("[data-call]");

    if (accept) {
        const requests = getRequests();
        const request = requests.find(item => item.id === accept.dataset.accept);
        if (!request) return;
        writeStorage(STORAGE.requests, requests.filter(item => item.id !== request.id));
        writeStorage(STORAGE.jobs, [{ ...request, status: "Accepted" }, ...getJobs()]);
        renderAll();
        notify("Request accepted");
    }

    if (decline) {
        writeStorage(STORAGE.requests, getRequests().filter(item => item.id !== decline.dataset.decline));
        renderAll();
        notify("Request declined");
    }

    if (update) {
        const jobs = getJobs();
        const job = jobs.find(item => item.id === update.dataset.update);
        if (!job) return;
        if (job.status === "Accepted") job.status = "In progress";
        else if (job.status === "In progress") job.status = "Completed";
        else {
            notify("Receipt is ready");
            return;
        }
        writeStorage(STORAGE.jobs, jobs);
        renderAll();
        notify(`Job marked ${job.status.toLowerCase()}`);
    }

    if (call) notify("Customer phone number copied");
});

availabilityToggle.addEventListener("click", () => {
    const next = !readStorage(STORAGE.availability, true);
    writeStorage(STORAGE.availability, next);
    renderAvailability();
    notify(next ? "You are online" : "You are offline");
});

profileForm.addEventListener("submit", event => {
    event.preventDefault();
    if (!profileForm.reportValidity()) return;
    writeStorage(STORAGE.profile, Object.fromEntries(new FormData(profileForm).entries()));
    renderIdentity();
    document.getElementById("profile-message").textContent = "Profile saved successfully.";
    notify("Worker profile updated");
});

profileForm.addEventListener("reset", () => setTimeout(renderIdentity));
window.addEventListener("hashchange", () => showView(location.hash.slice(1), false));
showView(location.hash.slice(1) || "overview", false);
