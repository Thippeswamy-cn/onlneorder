const themeToggle = document.querySelector(".theme-toggle");
const savedTheme = localStorage.getItem("localConnectTheme");
const headerProfile = document.getElementById("header-profile");
const desktopProfileLink = document.getElementById("desktop-profile-link");
const mobileProfileLink = document.getElementById("mobile-profile-link");

function getStoredProfile() {
    try {
        return JSON.parse(localStorage.getItem("localConnectProfile") || "null");
    } catch {
        return null;
    }
}

function getInitials(name, email) {
    const source = String(name || email || "User").trim();
    const words = source.split(/\s+/).filter(Boolean);
    if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
    return source.slice(0, 2).toUpperCase();
}

function renderHeaderProfile() {
    const profile = getStoredProfile();
    if (!profile || !headerProfile) return;

    const displayName = profile.name || "User";
    const email = profile.email || "";
    headerProfile.href = "index.html";
    headerProfile.classList.add("profile-chip");
    headerProfile.setAttribute("aria-label", `Profile: ${displayName}`);
    headerProfile.innerHTML = `
        <span class="profile-avatar" aria-hidden="true">${getInitials(displayName, email)}</span>
        <span class="profile-copy"><strong>${displayName}</strong><small>${email}</small></span>
    `;

    if (desktopProfileLink) desktopProfileLink.textContent = displayName;
    if (mobileProfileLink) {
        const label = mobileProfileLink.querySelector("span");
        if (label) label.textContent = "Profile";
    }
}

renderHeaderProfile();

function setNightMode(isNightMode) {
    document.body.classList.toggle("night-mode", isNightMode);
    themeToggle.setAttribute("aria-pressed", String(isNightMode));
    themeToggle.setAttribute("aria-label", isNightMode ? "Switch to day mode" : "Switch to night mode");
}

setNightMode(savedTheme === "night");

themeToggle.addEventListener("click", () => {
    const isNightMode = !document.body.classList.contains("night-mode");
    setNightMode(isNightMode);
    localStorage.setItem("localConnectTheme", isNightMode ? "night" : "day");
});

const search = document.getElementById("service-search");
const providers = [...document.querySelectorAll(".provider-card")];
const emptyState = document.getElementById("empty-state");

function filterServices(query) {
    const term = query.trim().toLowerCase();
    providers.forEach(card => {
        const matches = !term || card.dataset.service.includes(term) || card.textContent.toLowerCase().includes(term);
        card.classList.toggle("hidden", !matches);
    });
    emptyState.classList.toggle("hidden", providers.some(card => !card.classList.contains("hidden")));
}

search.addEventListener("input", () => filterServices(search.value));

const requestedService = new URLSearchParams(window.location.search).get("service");
if (requestedService) {
    search.value = requestedService.replaceAll("-", " ");
    filterServices(search.value);
    document.getElementById("recommended").scrollIntoView({ block: "start" });
}

document.querySelectorAll(".bookmark").forEach(button => {
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
        const saved = button.classList.toggle("saved");
        button.textContent = saved ? "♥" : "♡";
        button.setAttribute("aria-pressed", String(saved));
    });
});

document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        search.focus();
    }
});

const bottomNav = document.querySelector(".bottom-nav");

if (bottomNav) {
    const mobileNavigation = window.matchMedia("(max-width: 820px)");
    const directionThreshold = 8;
    const lowerAfter = 60;
    let previousScrollY = Math.max(window.scrollY, 0);
    let direction = 0;
    let directionDistance = 0;
    let ticking = false;

    const resetBottomNav = () => {
        bottomNav.classList.remove("is-scroll-lowered");
        previousScrollY = Math.max(window.scrollY, 0);
        direction = 0;
        directionDistance = 0;
    };

    const updateBottomNav = () => {
        const currentScrollY = Math.max(window.scrollY, 0);
        const delta = currentScrollY - previousScrollY;
        const currentDirection = Math.sign(delta);

        if (currentScrollY <= 4 || !mobileNavigation.matches) {
            resetBottomNav();
        } else if (currentDirection !== 0) {
            if (currentDirection !== direction) {
                direction = currentDirection;
                directionDistance = 0;
            }

            directionDistance += Math.abs(delta);

            if (directionDistance >= directionThreshold) {
                if (direction > 0 && currentScrollY > lowerAfter) {
                    bottomNav.classList.add("is-scroll-lowered");
                } else if (direction < 0) {
                    bottomNav.classList.remove("is-scroll-lowered");
                }
                directionDistance = 0;
            }
        }

        previousScrollY = currentScrollY;
        ticking = false;
    };

    const handleScroll = () => {
        if (!ticking) {
            window.requestAnimationFrame(updateBottomNav);
            ticking = true;
        }
    };

    const cleanupBottomNav = () => {
        window.removeEventListener("scroll", handleScroll);
        mobileNavigation.removeEventListener("change", resetBottomNav);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    mobileNavigation.addEventListener("change", resetBottomNav);
    window.addEventListener("pagehide", cleanupBottomNav, { once: true });
}

const categoryChips = [...document.querySelectorAll(".category-chips a")];
const providerList = document.getElementById("provider-list");
let filterTimer;

categoryChips.forEach(chip => {
    chip.addEventListener("click", event => {
        const url = new URL(chip.href, window.location.href);
        const service = url.searchParams.get("service");
        if (!service) return;

        event.preventDefault();
        categoryChips.forEach(item => item.classList.toggle("is-selected", item === chip));
        search.value = service.replaceAll("-", " ");
        providerList.classList.add("is-filtering");
        window.clearTimeout(filterTimer);
        filterTimer = window.setTimeout(() => {
            filterServices(search.value);
            providerList.classList.remove("is-filtering");
        }, 180);
    });
});

const revealTargets = [...document.querySelectorAll(".content-section, .final-cta")];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (reducedMotion || !("IntersectionObserver" in window)) {
    revealTargets.forEach(section => section.classList.add("is-visible"));
} else {
    revealTargets.forEach(section => section.classList.add("reveal-ready"));
    const revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
        });
    }, { threshold: .17 });
    revealTargets.forEach(section => revealObserver.observe(section));
    window.addEventListener("pagehide", () => revealObserver.disconnect(), { once: true });
}

document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener("click", () => {
        const targetId = link.getAttribute("href");
        if (!targetId || targetId === "#") return;
        const target = document.querySelector(targetId);
        if (!target) return;
        window.setTimeout(() => {
            target.classList.remove("section-highlight");
            void target.offsetWidth;
            target.classList.add("section-highlight");
        }, reducedMotion ? 0 : 320);
    });
});
