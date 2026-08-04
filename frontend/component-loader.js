async function loadComponent(selector, url) {
    const host = document.querySelector(selector);
    if (!host) throw new Error(`Component host not found: ${selector}`);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
    host.outerHTML = await response.text();
}

async function startHomePage() {
    try {
        await loadComponent('[data-component="location"]', "components/location.html");
        await import("./location.js");
        await import("./home.js");
        await import("./premium-card.js");
    } catch (error) {
        console.error("LocalConnect failed to start:", error);
        document.body.classList.add("component-load-error");
    }
}

startHomePage();
