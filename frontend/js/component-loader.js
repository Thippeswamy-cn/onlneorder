async function loadComponent(selector, url) {
    const host = document.querySelector(selector);
    if (!host) throw new Error(`Component host not found: ${selector}`);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
    host.outerHTML = await response.text();
}

async function startHomePage() {
    try {
        await loadComponent('[data-component="location"]', "/components/location.html");
        const { hydrateAccountState } = await import("./account-state.js");
        await hydrateAccountState().catch(error => {
            console.warn("Account sync is temporarily unavailable:", error.message);
        });
        await import("./location.js");
        await import("./home.js?v=20260813-3");
        await import("./premium-card.js");
    } catch (error) {
        console.error("LocalConnect failed to start:", error);
        document.body.classList.add("component-load-error");
    }
}

startHomePage();
