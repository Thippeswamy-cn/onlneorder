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

const locationButton = document.getElementById("location-button");
const locationSummary = document.getElementById("location-summary");
const locationDialog = document.getElementById("location-dialog");
const locationClose = document.getElementById("location-close");
const locationRetry = document.getElementById("location-retry");
const locationMap = document.getElementById("live-location-map");
const locationPlaceholder = document.getElementById("location-placeholder");
const locationStatus = document.getElementById("location-status");
const locationTip = document.getElementById("location-tip");
const locationName = document.getElementById("location-name");
const locationNameText = document.getElementById("location-name-text");
const locationSearch = document.getElementById("location-search");
const locationSearchInput = document.getElementById("location-search-input");
const locationSearchResults = document.getElementById("location-search-results");
const locationDone = document.getElementById("location-done");
const savedLocationLabel = localStorage.getItem("localConnectLocationLabel");
const savedLocationData = localStorage.getItem("localConnectSelectedLocation");
const locationDetails = document.getElementById("location-details");
const latitudeOutput = document.getElementById("live-latitude");
const longitudeOutput = document.getElementById("live-longitude");
const accuracyOutput = document.getElementById("live-accuracy");
const mapsLink = document.getElementById("location-maps-link");
let locationWatchId = null;
let lastMapUpdate = 0;
let bestAccuracy = Infinity;
let bestPosition = null;
let geocodeTimer = null;
let lastGeocodedPosition = null;
const areaNameCache = new Map();
let isViewingSearch = false;
let selectedLocation = null;
let searchSubmittedWithEnter = false;

try {
    selectedLocation = savedLocationData ? JSON.parse(savedLocationData) : null;
} catch {
    localStorage.removeItem("localConnectSelectedLocation");
}

if (selectedLocation?.label || savedLocationLabel) {
    const initialLabel = selectedLocation?.label || savedLocationLabel;
    locationSummary.textContent = initialLabel;
    locationSummary.title = initialLabel;
    locationButton.setAttribute("aria-label", `Selected location: ${initialLabel}`);
}

function saveSelectedLocation(location) {
    selectedLocation = location;
    localStorage.setItem("localConnectSelectedLocation", JSON.stringify(location));
    localStorage.setItem("localConnectLocationLabel", location.label);
    locationSummary.textContent = location.label;
    locationSummary.title = location.label;
    locationButton.setAttribute("aria-label", `Selected location: ${location.label}`);
}

function showGoogleMap(query, zoom = 17) {
    const mapUrl = new URL("https://maps.google.com/maps");
    mapUrl.searchParams.set("q", query);
    mapUrl.searchParams.set("z", String(zoom));
    mapUrl.searchParams.set("output", "embed");
    locationMap.src = mapUrl.toString();
    locationMap.hidden = false;
    locationPlaceholder.hidden = true;
}

function showSavedLocation() {
    if (!selectedLocation?.label) return false;
    isViewingSearch = selectedLocation.source === "search";
    locationName.hidden = false;
    locationNameText.textContent = selectedLocation.label;
    const hasCoordinates =
        Number.isFinite(selectedLocation.latitude) &&
        Number.isFinite(selectedLocation.longitude);
    const mapQuery = hasCoordinates
        ? `${selectedLocation.latitude},${selectedLocation.longitude}`
        : selectedLocation.label;
    showGoogleMap(mapQuery, hasCoordinates ? 17 : 15);
    if (hasCoordinates) {
        latitudeOutput.textContent = Number(selectedLocation.latitude).toFixed(6);
        longitudeOutput.textContent = Number(selectedLocation.longitude).toFixed(6);
        accuracyOutput.textContent = selectedLocation.accuracy
            ? `±${Math.round(selectedLocation.accuracy)} m`
            : "Selected";
        locationDetails.hidden = false;
    }
    mapsLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
    mapsLink.hidden = false;
    mapsLink.textContent = "Open in Google Maps";
    locationStatus.textContent = selectedLocation.source === "live"
        ? "Showing your saved live location."
        : "Showing your selected address.";
    locationTip.hidden = true;
    return true;
}

function distanceInMetres(first, second) {
    const radius = 6371000;
    const toRadians = value => value * Math.PI / 180;
    const latitudeDelta = toRadians(second.latitude - first.latitude);
    const longitudeDelta = toRadians(second.longitude - first.longitude);
    const value =
        Math.sin(latitudeDelta / 2) ** 2 +
        Math.cos(toRadians(first.latitude)) *
        Math.cos(toRadians(second.latitude)) *
        Math.sin(longitudeDelta / 2) ** 2;
    return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function showLocationError(error) {
    const messages = {
        1: "Location permission was denied. Allow location access in your browser settings, then try again.",
        2: "Your position is unavailable. Turn on your device's location service and try again.",
        3: "Finding your position took too long. Check your connection and try again."
    };
    locationPlaceholder.querySelector("strong").textContent = "Location unavailable";
    locationPlaceholder.querySelector("small").textContent = messages[error.code] || "We could not read your current location.";
    locationPlaceholder.classList.add("has-error");
    locationStatus.textContent = messages[error.code] || "We could not read your current location.";
    locationRetry.disabled = false;
}

function readableArea(address, fallbackName) {
    const localArea =
        address.neighbourhood ||
        address.suburb ||
        address.quarter ||
        address.residential ||
        address.village ||
        address.town ||
        address.city_district;
    const city =
        address.city ||
        address.town ||
        address.village ||
        address.municipality ||
        address.county;
    const parts = [localArea, city, address.state]
        .filter(Boolean)
        .filter((part, index, values) => values.indexOf(part) === index);
    return parts.join(", ") || fallbackName || "Area name unavailable";
}

async function updateAreaName(latitude, longitude) {
    const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    if (areaNameCache.has(cacheKey)) {
        const savedName = areaNameCache.get(cacheKey);
        if (!isViewingSearch) {
            locationNameText.textContent = savedName;
            saveSelectedLocation({
                label: savedName,
                latitude,
                longitude,
                accuracy: bestAccuracy,
                source: "live"
            });
        }
        return;
    }

    locationNameText.textContent = "Finding area name…";
    try {
        const url = new URL("https://nominatim.openstreetmap.org/reverse");
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("lat", latitude);
        url.searchParams.set("lon", longitude);
        url.searchParams.set("zoom", "16");
        url.searchParams.set("addressdetails", "1");
        url.searchParams.set("accept-language", navigator.language || "en");
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("Area lookup failed");
        const result = await response.json();
        const areaName = result.display_name || readableArea(result.address || {}, "");
        areaNameCache.set(cacheKey, areaName);
        if (!isViewingSearch) {
            locationNameText.textContent = areaName;
            saveSelectedLocation({
                label: areaName,
                latitude,
                longitude,
                accuracy: bestAccuracy,
                source: "live"
            });
        }
    } catch {
        if (!isViewingSearch) {
            locationNameText.textContent = "Area name unavailable";
            locationSummary.textContent = "Live location found";
        }
    }
}

function scheduleAreaNameUpdate(latitude, longitude) {
    const position = { latitude, longitude };
    if (
        lastGeocodedPosition &&
        distanceInMetres(lastGeocodedPosition, position) < 75
    ) return;

    clearTimeout(geocodeTimer);
    geocodeTimer = setTimeout(() => {
        lastGeocodedPosition = position;
        updateAreaName(latitude, longitude);
    }, 1200);
}

function showLiveLocation(position) {
    if (isViewingSearch) return;
    const { latitude, longitude, accuracy } = position.coords;
    const now = Date.now();
    const currentPosition = { latitude, longitude };
    const movement = bestPosition ? distanceInMetres(bestPosition, currentPosition) : Infinity;
    const isBetterReading = accuracy < bestAccuracy;
    const isRealMovement = bestPosition && movement > Math.max(accuracy, bestAccuracy, 20);

    // GPS often returns a rough network fix first. Keep listening, but do not
    // let a later, less accurate reading move the marker to a false position.
    if (bestPosition && !isBetterReading && !isRealMovement) {
        locationStatus.textContent =
            bestAccuracy <= 100
                ? `Live position active, accurate to about ${Math.round(bestAccuracy)} metres.`
                : `Still improving accuracy (currently about ${Math.round(bestAccuracy)} metres).`;
        return;
    }

    bestAccuracy = isRealMovement ? accuracy : Math.min(bestAccuracy, accuracy);
    bestPosition = currentPosition;

    latitudeOutput.textContent = latitude.toFixed(6);
    longitudeOutput.textContent = longitude.toFixed(6);
    accuracyOutput.textContent = `±${Math.round(accuracy)} m`;
    locationDetails.hidden = false;
    mapsLink.hidden = false;
    mapsLink.href = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    mapsLink.textContent = "Open in Google Maps";
    locationName.hidden = false;
    locationSummary.textContent = "Finding area name…";
    locationButton.setAttribute("aria-label", `Current live location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
    const isPrecise = accuracy <= 100;
    locationStatus.textContent = isPrecise
        ? `Live GPS position found, accurate to about ${Math.round(accuracy)} metres.`
        : `Approximate position found (accuracy is about ${Math.round(accuracy)} metres). Waiting for a better GPS reading…`;
    locationTip.hidden = isPrecise;
    locationTip.textContent =
        "For the correct precise location, turn on Precise location/GPS for your browser, switch off any VPN, and try near a window or outdoors. Desktop computers without GPS may only provide an approximate Wi-Fi location.";
    locationRetry.disabled = false;
    scheduleAreaNameUpdate(latitude, longitude);

    if (now - lastMapUpdate >= 4000 || locationMap.hidden || isBetterReading) {
        showGoogleMap(`${latitude},${longitude}`, 17);
        lastMapUpdate = now;
    }
}

function startLiveLocation() {
    isViewingSearch = false;
    locationRetry.disabled = true;
    locationStatus.textContent = "Requesting your current location…";
    locationPlaceholder.hidden = false;
    locationPlaceholder.classList.remove("has-error");
    locationPlaceholder.querySelector("strong").textContent = "Finding your location…";
    locationPlaceholder.querySelector("small").textContent = "Please allow location access when your browser asks.";
    bestAccuracy = Infinity;
    bestPosition = null;
    lastMapUpdate = 0;
    lastGeocodedPosition = null;
    clearTimeout(geocodeTimer);
    locationTip.hidden = true;
    locationName.hidden = true;

    if (!window.isSecureContext || !navigator.geolocation) {
        showLocationError({ code: 0 });
        locationStatus.textContent = "Location needs HTTPS or localhost and a browser with location support.";
        return;
    }

    if (locationWatchId !== null) navigator.geolocation.clearWatch(locationWatchId);
    locationWatchId = navigator.geolocation.watchPosition(showLiveLocation, showLocationError, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 60000
    });
}

locationButton.addEventListener("click", () => {
    locationDialog.showModal();
    const restored = showSavedLocation();
    if (!restored || selectedLocation?.source === "live") startLiveLocation();
});
locationClose.addEventListener("click", () => locationDialog.close());
locationDone.addEventListener("click", () => locationDialog.close());
locationRetry.addEventListener("click", startLiveLocation);
locationSearchInput.addEventListener("keydown", event => {
    searchSubmittedWithEnter = event.key === "Enter";
});
locationSearch.addEventListener("submit", async event => {
    event.preventDefault();
    const selectFirstResult = searchSubmittedWithEnter;
    searchSubmittedWithEnter = false;
    const query = locationSearchInput.value.trim();
    if (!query) {
        locationSearchInput.focus();
        return;
    }

    // Always show the user's query in Google Maps. Structured address lookup
    // improves the result when available, but must never block the map.
    isViewingSearch = true;
    if (locationWatchId !== null) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
    }
    saveSelectedLocation({
        label: query,
        latitude: null,
        longitude: null,
        accuracy: null,
        source: "search"
    });
    locationName.hidden = false;
    locationNameText.textContent = query;
    locationDetails.hidden = true;
    showGoogleMap(query, 15);
    const typedSearchUrl = new URL("https://www.google.com/maps/search/");
    typedSearchUrl.searchParams.set("api", "1");
    typedSearchUrl.searchParams.set("query", query);
    mapsLink.href = typedSearchUrl.toString();
    mapsLink.hidden = false;
    mapsLink.textContent = "Open in Google Maps";
    locationStatus.textContent = `Showing Google Maps results for “${query}”.`;
    locationTip.hidden = true;

    locationSearchResults.hidden = false;
    locationSearchResults.replaceChildren();
    const loadingMessage = document.createElement("p");
    loadingMessage.className = "location-search-message";
    loadingMessage.textContent = "Searching for matching addresses…";
    locationSearchResults.append(loadingMessage);

    try {
        const searchUrl = new URL("https://nominatim.openstreetmap.org/search");
        searchUrl.searchParams.set("format", "jsonv2");
        searchUrl.searchParams.set("q", query);
        searchUrl.searchParams.set("limit", "5");
        searchUrl.searchParams.set("addressdetails", "1");
        searchUrl.searchParams.set("accept-language", navigator.language || "en");
        const response = await fetch(searchUrl, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("Search failed");
        const results = await response.json();
        locationSearchResults.replaceChildren();

        if (!results.length) {
            const noResults = document.createElement("p");
            noResults.className = "location-search-message";
            noResults.textContent = "The map is showing your search. Add a city, state or postcode for a more exact marker.";
            locationSearchResults.append(noResults);
            locationStatus.textContent = `Google Maps is showing results for “${query}”.`;
            return;
        }

        const selectResult = result => {
            const latitude = Number(result.lat);
            const longitude = Number(result.lon);
            const label = result.display_name;
            isViewingSearch = true;
            if (locationWatchId !== null) {
                navigator.geolocation.clearWatch(locationWatchId);
                locationWatchId = null;
            }
            saveSelectedLocation({ label, latitude, longitude, accuracy: null, source: "search" });
            locationName.hidden = false;
            locationNameText.textContent = label;
            latitudeOutput.textContent = latitude.toFixed(6);
            longitudeOutput.textContent = longitude.toFixed(6);
            accuracyOutput.textContent = "Selected";
            locationDetails.hidden = false;
            showGoogleMap(`${latitude},${longitude}`, 17);
            mapsLink.href = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
            mapsLink.hidden = false;
            mapsLink.textContent = "Open in Google Maps";
            locationStatus.textContent = "Address selected. Press Done to continue.";
            locationTip.hidden = true;
            locationSearchResults.hidden = true;
        };

        if (selectFirstResult) {
            selectResult(results[0]);
            return;
        }

        results.forEach(result => {
            const resultButton = document.createElement("button");
            resultButton.type = "button";
            resultButton.className = "location-search-result";
            resultButton.setAttribute("role", "option");
            resultButton.setAttribute("aria-label", `Select ${result.display_name}`);
            const pin = document.createElement("span");
            pin.setAttribute("aria-hidden", "true");
            pin.textContent = "⌖";
            const address = document.createElement("strong");
            address.textContent = result.display_name;
            resultButton.append(pin, address);
            resultButton.addEventListener("click", () => selectResult(result));
            locationSearchResults.append(resultButton);
        });
        locationStatus.textContent = "Choose the correct address from the search results.";
    } catch {
        locationSearchResults.replaceChildren();
        const errorMessage = document.createElement("p");
        errorMessage.className = "location-search-message";
        errorMessage.textContent = "The exact-address service is unavailable, but Google Maps has still been updated.";
        locationSearchResults.append(errorMessage);
        locationStatus.textContent = `Google Maps is showing results for “${query}”.`;
    }
});
locationDialog.addEventListener("click", event => {
    if (event.target === locationDialog) locationDialog.close();
});
window.addEventListener("pagehide", () => {
    if (locationWatchId !== null) navigator.geolocation.clearWatch(locationWatchId);
});

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
const serviceSearchForm = document.getElementById("service-search-form");
const serviceSearchResults = document.getElementById("service-search-results");
const serviceCards = [...document.querySelectorAll(".category-card")];
const providers = [...document.querySelectorAll(".provider-card")];
const emptyState = document.getElementById("empty-state");

function matchesService(element, term) {
    return (
        !term ||
        (element.dataset.service || "").toLowerCase().includes(term) ||
        element.textContent.toLowerCase().includes(term)
    );
}

function filterServices(query) {
    const term = query.trim().toLowerCase();
    serviceCards.forEach(card => card.classList.toggle("hidden", !matchesService(card, term)));
    providers.forEach(card => {
        card.classList.toggle("hidden", !matchesService(card, term));
    });
    emptyState.classList.toggle("hidden", providers.some(card => !card.classList.contains("hidden")));
}

function selectService(card) {
    const serviceName = card.querySelector("strong").textContent;
    search.value = serviceName;
    serviceSearchResults.hidden = true;
    filterServices(card.dataset.service.split(" ")[0]);
    document.getElementById("categories").scrollIntoView({ behavior: "smooth", block: "start" });
}

function showServiceSuggestions(query) {
    const term = query.trim().toLowerCase();
    serviceSearchResults.replaceChildren();
    filterServices(term);
    if (!term) {
        serviceSearchResults.hidden = true;
        return;
    }

    const matches = serviceCards.filter(card => matchesService(card, term));
    matches.forEach(card => {
        const result = document.createElement("button");
        result.type = "button";
        result.className = "service-search-result";
        result.setAttribute("role", "option");

        const icon = card.querySelector(".category-icon").cloneNode(true);
        const copy = document.createElement("span");
        const title = document.createElement("strong");
        const description = document.createElement("small");
        title.textContent = card.querySelector("strong").textContent;
        description.textContent = card.querySelector("small").textContent;
        copy.append(title, description);
        result.append(icon, copy);
        result.addEventListener("click", () => selectService(card));
        serviceSearchResults.append(result);
    });

    if (!matches.length) {
        const message = document.createElement("p");
        message.className = "location-search-message";
        message.textContent = "No matching service found.";
        serviceSearchResults.append(message);
    }
    serviceSearchResults.hidden = false;
}

search.addEventListener("input", () => showServiceSuggestions(search.value));
serviceSearchForm.addEventListener("submit", event => {
    event.preventDefault();
    const term = search.value.trim().toLowerCase();
    const firstMatch = serviceCards.find(card => matchesService(card, term));
    if (firstMatch) {
        selectService(firstMatch);
    } else {
        showServiceSuggestions(search.value);
    }
});

document.addEventListener("click", event => {
    if (!serviceSearchForm.contains(event.target)) serviceSearchResults.hidden = true;
});

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
