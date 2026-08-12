const switchButtons = [...document.querySelectorAll("[data-dashboard]")];
const panels = [...document.querySelectorAll("[data-dashboard-panel]")];
const userFrame = document.getElementById("user-dashboard-frame");

function normalizeDashboard(value) {
    return value === "worker" ? "worker" : "user";
}

function routeForDashboard(dashboard) {
    if (dashboard === "user" && location.hash === "#favourites") {
        return "customer-dashboard.html#favourites";
    }

    return dashboard === "worker" ? "worker-dashboard.html" : "customer-dashboard.html";
}

function showDashboard(value, updateHash = true) {
    const dashboard = normalizeDashboard(value);

    switchButtons.forEach(button => {
        const isActive = button.dataset.dashboard === dashboard;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });

    panels.forEach(panel => {
        const isActive = panel.dataset.dashboardPanel === dashboard;
        panel.classList.toggle("active", isActive);
        panel.hidden = !isActive;
    });

    if (dashboard === "user") {
        const route = routeForDashboard(dashboard);
        if (!userFrame.src.endsWith(route)) {
            userFrame.src = route;
        }
    }

    if (updateHash) {
        history.replaceState(null, "", `#${dashboard}`);
    }
}

switchButtons.forEach(button => {
    button.addEventListener("click", () => showDashboard(button.dataset.dashboard));
});

window.addEventListener("hashchange", () => {
    const hash = location.hash.slice(1);
    showDashboard(hash === "favourites" ? "user" : hash, false);
});

showDashboard(location.hash.slice(1) === "favourites" ? "user" : location.hash.slice(1), false);
