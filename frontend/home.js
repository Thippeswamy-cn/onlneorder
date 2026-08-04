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
    headerProfile.href = "customer-dashboard.html";
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
const serviceSearchForm = document.getElementById("service-search-form");
const serviceSearchResults = document.getElementById("service-search-results");
const serviceCards = [...document.querySelectorAll(".category-card")];
let providers = [...document.querySelectorAll(".provider-card")];
const emptyState = document.getElementById("empty-state");
const providerList = document.getElementById("provider-list");
const providerSection = document.getElementById("service-professionals");
const providerSectionHeading = document.getElementById("service-professionals-heading");
const providerSectionKicker = document.getElementById("provider-section-kicker");

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
    filterProviders(term);
}

function filterProviders(query) {
    const term = query.trim().toLowerCase();
    providers.forEach(card => {
        card.classList.toggle("hidden", !matchesService(card, term));
    });
    emptyState.classList.toggle("hidden", providers.some(card => !card.classList.contains("hidden")));
}

function selectService(card) {
    const serviceName = card.querySelector("strong").textContent;
    search.value = serviceName;
    serviceSearchResults.hidden = true;
    serviceCards.forEach(item => item.classList.remove("hidden"));
    openCategoryDetails(card);
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
    const matchingCategory = serviceCards.find(card => matchesService(card, search.value));
    if (matchingCategory) window.setTimeout(() => matchingCategory.click());
}

serviceCards.forEach(card => {
    card.addEventListener("click", event => {
        event.preventDefault();
        serviceCards.forEach(item => item.classList.toggle("is-selected", item === card));
        openCategoryDetails(card);
    });
});

function showAllProviders() {
    search.value = "";
    serviceCards.forEach(card => card.classList.remove("hidden", "is-selected"));
    providers.forEach(card => card.classList.remove("hidden"));
    emptyState.classList.add("hidden");
    providerSectionHeading.textContent = "All service professionals";
    providerSectionKicker.textContent = "Browse by service";
}

document.getElementById("show-all-providers").addEventListener("click", () => {
    showAllProviders();
    providerSection.scrollIntoView({ behavior: "smooth", block: "start" });
});
document.getElementById("view-all-services").addEventListener("click", event => {
    event.preventDefault();
    serviceCards.forEach(card => card.classList.remove("hidden", "is-selected"));
    document.getElementById("categories").scrollIntoView({ behavior: "smooth", block: "start" });
});

function configureBookmark(button, card) {
    const profileLink = card.querySelector(".view-profile");
    const heading = card.querySelector("h3");
    const id = profileLink?.dataset.provider || heading?.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const readFavourites = () => {
        try { return JSON.parse(localStorage.getItem("localConnectFavourites") || "[]"); }
        catch { return []; }
    };
    const render = () => {
        const saved = readFavourites().some(item => item.id === id);
        button.classList.toggle("saved", saved);
        button.textContent = saved ? "♥" : "♡";
        button.setAttribute("aria-pressed", String(saved));
    };
    render();
    button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const favourites = readFavourites();
        const index = favourites.findIndex(item => item.id === id);
        if (index >= 0) favourites.splice(index, 1);
        else favourites.unshift({
            id,
            name: heading?.childNodes[0]?.textContent.trim() || heading?.textContent.trim() || "Service professional",
            type: card.querySelector(".professional-title p")?.textContent.trim() || "Local service professional",
            image: card.querySelector("img")?.getAttribute("src") || "assets/services/plumber.png",
            rating: card.querySelector(".rating")?.textContent.trim() || "Verified professional",
            service: (card.dataset.service || "").split(" ")[0]
        });
        localStorage.setItem("localConnectFavourites", JSON.stringify(favourites));
        render();
    });
}

document.querySelectorAll(".professional-card .bookmark").forEach(button => configureBookmark(button, button.closest(".professional-card")));

const providerProfiles = {
    "sri-sai": {
        name: "Sri Sai Plumbing Works", type: "Plumbing service",
        speciality: "Leaks, taps, pipes, bathroom fittings and installations",
        image: "assets/services/plumber.png", rating: "★ 4.8 (126 reviews)",
        distance: "2.1 km away", availability: "Available today",
        about: "A verified local plumbing team for household repairs, installations and urgent water leaks. You receive a price confirmation before work begins.",
        facts: [["Experience", "8+ years"], ["Jobs completed", "640+"], ["Service warranty", "30 days"]],
        services: [["Visit & inspection", "₹299"], ["Tap or minor leak repair", "₹399"], ["Toilet repair", "₹599"], ["Pipe blockage removal", "₹799"], ["Bathroom fitting installation", "₹999"]],
        inclusions: ["Verified professional and safety check", "Upfront estimate before repair", "Basic cleanup after service"],
        startingPrice: "₹299", bookingService: "plumber"
    },
    "rk-motors": {
        name: "RK Motors & Service", type: "Vehicle repair service",
        speciality: "Car and bike diagnostics, servicing and mechanical repair",
        image: "assets/services/car-mechanic.png", rating: "★ 4.7 (89 reviews)",
        distance: "4.5 km away", availability: "Available today",
        about: "A multi-brand vehicle workshop providing routine maintenance, fault diagnosis and repair for cars and motorcycles, with approval required for replacement parts.",
        facts: [["Experience", "11+ years"], ["Vehicles serviced", "1,200+"], ["Service warranty", "15 days"]],
        services: [["Vehicle inspection", "₹499"], ["Bike general service", "₹799"], ["Car oil service", "₹1,499"], ["Brake inspection & service", "₹999"], ["Roadside assistance", "₹699"]],
        inclusions: ["Initial diagnostic check", "Labour estimate before work", "Digital service summary"],
        startingPrice: "₹499", bookingService: "car-mechanic"
    },
    "davangere-electricals": {
        name: "Davangere Electricals", type: "Electrical service",
        speciality: "Wiring, switches, lighting, fans and electrical safety checks",
        image: "assets/services/electrician.png", rating: "★ 4.9 (74 reviews)",
        distance: "3.2 km away", availability: "Available now",
        about: "A certified electrician for safe home repairs and installations. All work is checked before completion, and any extra material cost is explained in advance.",
        facts: [["Experience", "9+ years"], ["Jobs completed", "510+"], ["Service warranty", "30 days"]],
        services: [["Visit & safety inspection", "₹349"], ["Switch or socket repair", "₹399"], ["Fan installation", "₹549"], ["Light fitting installation", "₹449"], ["Partial wiring repair", "₹899"]],
        inclusions: ["Electrical safety check", "Upfront labour estimate", "30-day workmanship support"],
        startingPrice: "₹349", bookingService: "electrician"
    },
    "sparkle-home-care": {
        name: "Sparkle Home Care", type: "Home cleaning service",
        speciality: "Regular cleaning, deep cleaning, kitchens and bathrooms",
        image: "assets/services/cleaning.png", rating: "★ 4.8 (112 reviews)",
        distance: "2.8 km away", availability: "Available today",
        about: "A trained cleaning team for routine and intensive home cleaning. Choose the rooms you need and see the labour price before confirming.",
        facts: [["Experience", "6+ years"], ["Homes cleaned", "870+"], ["Service warranty", "3 days"]],
        services: [["Bathroom cleaning", "₹399"], ["Kitchen deep cleaning", "₹699"], ["1 BHK full-home cleaning", "₹1,299"], ["2 BHK full-home cleaning", "₹1,799"], ["Sofa cleaning", "₹499"]],
        inclusions: ["Cleaning equipment and standard products", "Trained, background-checked team", "Post-service quality check"],
        startingPrice: "₹399", bookingService: "cleaning"
    },
    "cooltech": {
        name: "CoolTech Appliance Care", type: "Appliance repair service",
        speciality: "AC, refrigerator, washing machine and small appliance repair",
        image: "assets/services/ac-repair.png", rating: "★ 4.7 (96 reviews)",
        distance: "3.7 km away", availability: "Available today",
        about: "A multi-appliance technician offering fault checks, servicing and repair. Spare parts are charged separately only after your approval.",
        facts: [["Experience", "10+ years"], ["Repairs completed", "930+"], ["Service warranty", "30 days"]],
        services: [["Appliance inspection", "₹399"], ["AC general service", "₹699"], ["AC deep service", "₹999"], ["Washing machine repair", "₹599"], ["Refrigerator repair", "₹649"]],
        inclusions: ["Fault diagnosis", "Repair estimate before work", "30-day workmanship warranty"],
        startingPrice: "₹399", bookingService: "appliance-repair"
    },
    "glow-at-home": {
        name: "Glow at Home", type: "Beauty service",
        speciality: "Hair, skincare, makeup and salon treatments at home",
        image: "assets/services/cleaning.png", rating: "★ 4.9 (138 reviews)",
        distance: "2.5 km away", availability: "Available tomorrow",
        about: "Professional salon services delivered at home with sanitized tools and single-use essentials. Select individual treatments or a complete package.",
        facts: [["Experience", "7+ years"], ["Appointments", "1,050+"], ["Hygiene", "Certified"]],
        services: [["Haircut", "₹499"], ["Waxing package", "₹799"], ["Facial cleanup", "₹699"], ["Party makeup", "₹1,499"], ["Manicure & pedicure", "₹999"]],
        inclusions: ["Sanitized tools", "Single-use hygiene essentials", "Consultation before treatment"],
        startingPrice: "₹499", bookingService: "beauty"
    },
    "safemove": {
        name: "SafeMove Packers", type: "Moving service",
        speciality: "Packing, loading, transport and local household shifting",
        image: "assets/services/car-mechanic.png", rating: "★ 4.6 (67 reviews)",
        distance: "5.1 km away", availability: "Available tomorrow",
        about: "A careful local moving crew for rooms, apartments and small offices. A survey confirms the final price based on distance and load.",
        facts: [["Experience", "9+ years"], ["Moves completed", "480+"], ["Damage cover", "Included"]],
        services: [["Survey & booking", "₹999"], ["Single-room move", "₹2,499"], ["1 BHK local move", "₹4,999"], ["2 BHK local move", "₹7,499"], ["Small office move", "₹8,999"]],
        inclusions: ["Packing materials estimate", "Loading and unloading crew", "Basic transit protection"],
        startingPrice: "₹999", bookingService: "moving"
    },
    "rapid-help": {
        name: "Rapid Help 24/7", type: "Emergency service",
        speciality: "Urgent plumbing, electrical and roadside assistance",
        image: "assets/services/plumber.png", rating: "★ 4.8 (81 reviews)",
        distance: "3.0 km away", availability: "Available now",
        about: "Fast dispatch for urgent household faults and roadside problems. The call-out fee covers arrival and diagnosis; repair costs are confirmed on site.",
        facts: [["Response time", "30–60 min"], ["Cases handled", "720+"], ["Availability", "24/7"]],
        services: [["Emergency call-out", "₹599"], ["Urgent water leak control", "₹799"], ["Electrical power fault", "₹899"], ["Door lock assistance", "₹699"], ["Roadside vehicle help", "₹999"]],
        inclusions: ["Priority dispatch", "On-site safety assessment", "Price approval before additional work"],
        startingPrice: "₹599", bookingService: "emergency"
    }
};

const additionalProviders = [
    { key: "aqua-fix", base: "sri-sai", name: "AquaFix Plumbing", rating: "★ 4.6 (58 reviews)", distance: "3.4 km away", availability: "Available today", experience: "5+ years" },
    { key: "pipe-care", base: "sri-sai", name: "PipeCare Solutions", rating: "★ 4.9 (91 reviews)", distance: "4.1 km away", availability: "Available tomorrow", experience: "9+ years" },
    { key: "power-pro", base: "davangere-electricals", name: "PowerPro Electricals", rating: "★ 4.7 (63 reviews)", distance: "2.6 km away", availability: "Available now", experience: "7+ years" },
    { key: "bright-wire", base: "davangere-electricals", name: "BrightWire Services", rating: "★ 4.8 (105 reviews)", distance: "4.8 km away", availability: "Available today", experience: "10+ years" },
    { key: "fresh-nest", base: "sparkle-home-care", name: "FreshNest Cleaners", rating: "★ 4.7 (84 reviews)", distance: "3.1 km away", availability: "Available today", experience: "5+ years" },
    { key: "neat-home", base: "sparkle-home-care", name: "NeatHome Experts", rating: "★ 4.9 (156 reviews)", distance: "4.3 km away", availability: "Available tomorrow", experience: "8+ years" },
    { key: "city-auto", base: "rk-motors", name: "City Auto Clinic", rating: "★ 4.8 (119 reviews)", distance: "3.8 km away", availability: "Available today", experience: "12+ years" },
    { key: "road-ready", base: "rk-motors", name: "RoadReady Mechanics", rating: "★ 4.6 (72 reviews)", distance: "5.6 km away", availability: "Available tomorrow", experience: "8+ years" },
    { key: "appliance-doctor", base: "cooltech", name: "Appliance Doctor", rating: "★ 4.8 (88 reviews)", distance: "2.9 km away", availability: "Available today", experience: "9+ years" },
    { key: "home-tech", base: "cooltech", name: "HomeTech Repairs", rating: "★ 4.6 (54 reviews)", distance: "5.0 km away", availability: "Available tomorrow", experience: "6+ years" },
    { key: "blush-beauty", base: "glow-at-home", name: "Blush Beauty Studio", rating: "★ 4.8 (97 reviews)", distance: "3.3 km away", availability: "Available today", experience: "6+ years" },
    { key: "radiant-you", base: "glow-at-home", name: "Radiant You Salon", rating: "★ 4.7 (79 reviews)", distance: "4.6 km away", availability: "Available tomorrow", experience: "8+ years" },
    { key: "easy-shift", base: "safemove", name: "EasyShift Movers", rating: "★ 4.7 (74 reviews)", distance: "4.2 km away", availability: "Available tomorrow", experience: "7+ years" },
    { key: "quick-pack", base: "safemove", name: "QuickPack Logistics", rating: "★ 4.8 (92 reviews)", distance: "6.0 km away", availability: "Available today", experience: "10+ years" },
    { key: "home-rescue", base: "rapid-help", name: "HomeRescue 24/7", rating: "★ 4.7 (69 reviews)", distance: "2.7 km away", availability: "Available now", experience: "8+ years" },
    { key: "urgent-assist", base: "rapid-help", name: "Urgent Assist Team", rating: "★ 4.9 (103 reviews)", distance: "4.0 km away", availability: "Available now", experience: "11+ years" }
];

const providerSearchTerms = {
    "sri-sai": "plumber plumbing pipe tap leak",
    "davangere-electricals": "electrician electrical wiring light",
    "sparkle-home-care": "cleaning cleaner housekeeping deep clean",
    "rk-motors": "car vehicle bike mechanic repair",
    cooltech: "appliance repair ac refrigerator fridge washer",
    "glow-at-home": "beauty salon haircut makeup spa",
    safemove: "moving movers packing delivery shifting transport",
    "rapid-help": "emergency urgent help plumbing electrical roadside"
};

additionalProviders.forEach(provider => {
    const base = providerProfiles[provider.base];
    providerProfiles[provider.key] = {
        ...base,
        name: provider.name,
        rating: provider.rating,
        distance: provider.distance,
        availability: provider.availability,
        about: `${provider.name} is a fictional sample professional created for this service marketplace demo. The team provides ${base.speciality.toLowerCase()} with pricing confirmed before work begins.`,
        facts: [["Experience", provider.experience], ["Profile", "Demo provider"], [base.facts[2][0], base.facts[2][1]]]
    };

    const card = document.createElement("article");
    card.className = "professional-card provider-card";
    card.dataset.service = providerSearchTerms[provider.base];
    const reviewText = provider.rating.match(/\(([^)]+)\)/)?.[1] || "New";
    const ratingText = provider.rating.split(" (")[0];
    card.innerHTML = `
        <img src="${base.image}" alt="${provider.name} service professional" loading="lazy">
        <div class="professional-main">
            <div class="professional-title">
                <div><h3>${provider.name} <span class="demo-profile-badge">Demo</span></h3><p>${base.type}</p></div>
                <button class="bookmark" type="button" aria-label="Save ${provider.name}" aria-pressed="false">♡</button>
            </div>
            <div class="professional-meta">
                <span class="rating">${ratingText} <small>(${reviewText})</small></span>
                <span>${provider.distance}</span>
                <span class="available"><i></i> ${provider.availability}</span>
            </div>
            <div class="professional-footer">
                <strong>From ${base.startingPrice}</strong>
                <div><a class="secondary-button view-profile" href="#" data-provider="${provider.key}">View Profile</a><a class="primary-button" href="home.html?service=${base.bookingService}">Book Now</a></div>
            </div>
        </div>`;
    const bookmark = card.querySelector(".bookmark");
    configureBookmark(bookmark, card);
    providerList.append(card);
});

providers = [...document.querySelectorAll(".provider-card")];
if (search.value) filterProviders(search.value);

const categoryDetailDialog = document.getElementById("category-detail-dialog");
const categoryDetailClose = document.getElementById("category-detail-close");
const categoryServiceList = document.getElementById("category-service-list");
const categoryProviderList = document.getElementById("category-provider-list");
const categoryProfileMap = {
    plumbing: "sri-sai",
    electrical: "davangere-electricals",
    cleaning: "sparkle-home-care",
    vehicle: "rk-motors",
    appliance: "cooltech",
    beauty: "glow-at-home",
    moving: "safemove",
    emergency: "rapid-help"
};

function openCategoryDetails(card) {
    const categoryKey = card.dataset.service.split(" ")[0];
    const baseProfile = providerProfiles[categoryProfileMap[categoryKey]];
    if (!baseProfile) return;
    const categoryName = card.querySelector("strong").textContent;
    document.getElementById("category-detail-title").textContent = categoryName;
    document.getElementById("category-detail-description").textContent = card.querySelector("small").textContent;
    document.getElementById("category-detail-icon").textContent = card.querySelector(".category-icon").textContent;
    document.getElementById("category-provider-heading").textContent = `${categoryName} professionals`;

    categoryServiceList.replaceChildren(...baseProfile.services.map(([service, price]) => {
        const row = document.createElement("button");
        row.type = "button";
        const copy = document.createElement("span");
        const name = document.createElement("strong");
        const note = document.createElement("small");
        const amount = document.createElement("b");
        name.textContent = service;
        note.textContent = "View professionals and book this service";
        amount.textContent = price;
        copy.append(name, note);
        row.append(copy, amount);
        row.addEventListener("click", () => {
            categoryDetailDialog.close();
            openBookingStep(baseProfile);
            window.setTimeout(() => {
                const option = [...bookingOptions.querySelectorAll('input[name="selected-service"]')]
                    .find(input => input.value === service);
                option?.click();
            });
        });
        return row;
    }));

    const matchingProfiles = Object.values(providerProfiles)
        .filter(profile => profile.bookingService === baseProfile.bookingService);
    categoryProviderList.replaceChildren(...matchingProfiles.map(profile => {
        const item = document.createElement("article");
        item.className = "category-provider-item";
        const image = document.createElement("img");
        const copy = document.createElement("div");
        const name = document.createElement("strong");
        const meta = document.createElement("span");
        const availability = document.createElement("small");
        const actions = document.createElement("div");
        const profileButton = document.createElement("button");
        const bookButton = document.createElement("button");
        image.src = profile.image;
        image.alt = `${profile.name} professional`;
        name.textContent = profile.name;
        meta.textContent = `${profile.rating} · ${profile.distance}`;
        availability.textContent = profile.availability;
        profileButton.type = "button";
        profileButton.className = "secondary-button";
        profileButton.textContent = "View details";
        bookButton.type = "button";
        bookButton.className = "primary-button";
        bookButton.textContent = "Book";
        profileButton.addEventListener("click", () => {
            categoryDetailDialog.close();
            fillProviderProfile(profile);
            profileDialog.showModal();
        });
        bookButton.addEventListener("click", () => {
            categoryDetailDialog.close();
            openBookingStep(profile);
        });
        copy.append(name, meta, availability);
        actions.append(profileButton, bookButton);
        item.append(image, copy, actions);
        return item;
    }));
    categoryDetailDialog.showModal();
}

categoryDetailClose.addEventListener("click", () => categoryDetailDialog.close());
categoryDetailDialog.addEventListener("click", event => {
    if (event.target === categoryDetailDialog) categoryDetailDialog.close();
});

const profileDialog = document.getElementById("service-profile-dialog");
const profileClose = document.getElementById("service-profile-close");
const profileBook = document.getElementById("service-profile-book");
let activeProfile = null;

function fillProviderProfile(profile) {
    activeProfile = profile;
    ["name", "type", "speciality", "rating", "distance", "availability", "about"].forEach(field => {
        document.getElementById(`service-profile-${field}`).textContent = profile[field];
    });
    document.getElementById("service-profile-starting-price").textContent = profile.startingPrice;
    const image = document.getElementById("service-profile-image");
    image.src = profile.image;
    image.alt = `${profile.name} professional`;

    const facts = document.getElementById("service-profile-facts");
    facts.replaceChildren(...profile.facts.map(([label, value]) => {
        const item = document.createElement("div");
        const small = document.createElement("small");
        const strong = document.createElement("strong");
        small.textContent = label;
        strong.textContent = value;
        item.append(small, strong);
        return item;
    }));

    const prices = document.getElementById("service-price-list");
    prices.replaceChildren(...profile.services.map(([service, price]) => {
        const item = document.createElement("div");
        const name = document.createElement("span");
        const amount = document.createElement("strong");
        name.textContent = service;
        amount.textContent = price;
        item.append(name, amount);
        return item;
    }));

    const inclusions = document.getElementById("service-profile-inclusions");
    inclusions.replaceChildren(...profile.inclusions.map(inclusion => {
        const item = document.createElement("li");
        item.textContent = inclusion;
        return item;
    }));
}

document.querySelectorAll(".view-profile").forEach(link => {
    link.addEventListener("click", event => {
        event.preventDefault();
        const profile = providerProfiles[link.dataset.provider];
        if (!profile) return;
        fillProviderProfile(profile);
        profileDialog.showModal();
    });
});

providers.forEach(card => {
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `View ${card.querySelector("h3")?.childNodes[0]?.textContent.trim() || "professional"} profile`);
    const openCardProfile = event => {
        if (event.type === "click" && event.target.closest("a, button")) return;
        if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
        if (event.type === "keydown") event.preventDefault();
        card.querySelector(".view-profile")?.click();
    };
    card.addEventListener("click", openCardProfile);
    card.addEventListener("keydown", openCardProfile);
});

profileClose.addEventListener("click", () => profileDialog.close());
profileDialog.addEventListener("click", event => {
    if (event.target === profileDialog) profileDialog.close();
});
profileBook.addEventListener("click", () => {
    if (!activeProfile) return;
    profileDialog.close();
    openBookingStep(activeProfile);
});

const bookingDialog = document.getElementById("booking-step-dialog");
const bookingForm = document.getElementById("booking-service-form");
const bookingOptions = document.getElementById("booking-service-options");
const bookingClose = document.getElementById("booking-step-close");
const bookingContinue = document.getElementById("booking-step-continue");
const bookingPrice = document.getElementById("booking-step-price");
const bookingNotes = document.getElementById("booking-service-notes");
const bookingNotesCount = document.getElementById("booking-notes-count");
const bookingMessage = document.getElementById("booking-step-message");
const scheduleForm = document.getElementById("booking-schedule-form");
const addressForm = document.getElementById("booking-address-form");
const reviewForm = document.getElementById("booking-review-form");
const successPanel = document.getElementById("booking-success-panel");
const bookingPanels = [bookingForm, scheduleForm, addressForm, reviewForm, successPanel];
const bookingTitles = ["Choose the service you need", "Choose a date and time", "Enter the service address", "Review and confirm"];
let bookingDraft = {};
let bookingProfile = null;

function showBookingStep(step) {
    bookingPanels.forEach((panel, index) => { panel.hidden = index !== step - 1; });
    document.querySelectorAll(".booking-progress li").forEach((item, index) => {
        item.classList.toggle("active", index === Math.min(step - 1, 3));
        item.classList.toggle("completed", index < step - 1);
    });
    document.getElementById("booking-step-title").textContent = step === 5 ? "Booking confirmed" : bookingTitles[Math.min(step - 1, 3)];
    bookingDialog.scrollTop = 0;
}

function populateBookingDates() {
    const container = document.getElementById("booking-date-options");
    const formatter = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" });
    container.replaceChildren(...Array.from({ length: 5 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() + index);
        const label = document.createElement("label");
        const input = document.createElement("input");
        const span = document.createElement("span");
        input.type = "radio";
        input.name = "booking-date";
        input.value = date.toISOString().slice(0, 10);
        input.required = true;
        span.textContent = index === 0 ? `Today · ${formatter.format(date)}` : formatter.format(date);
        label.append(input, span);
        return label;
    }));
}

function openBookingStep(profile) {
    bookingProfile = profile;
    bookingDraft = {};
    bookingForm.reset();
    scheduleForm.reset();
    addressForm.reset();
    reviewForm.reset();
    bookingContinue.disabled = true;
    bookingContinue.textContent = "Continue to schedule →";
    bookingPrice.textContent = "Select a service";
    bookingMessage.hidden = true;
    bookingNotesCount.textContent = "0";
    document.getElementById("booking-provider-name").textContent = profile.name;
    document.getElementById("booking-service-type").textContent = profile.type;
    document.getElementById("booking-provider-rating").textContent = profile.rating;
    const image = document.getElementById("booking-provider-image");
    image.src = profile.image;
    image.alt = `${profile.name} professional`;
    populateBookingDates();
    const savedAddress = JSON.parse(localStorage.getItem("localConnectSavedAddress") || "null");
    if (savedAddress) Object.entries(savedAddress).forEach(([name, value]) => {
        if (addressForm.elements[name]) addressForm.elements[name].value = value;
    });

    bookingOptions.replaceChildren(...profile.services.map(([service, price], index) => {
        const label = document.createElement("label");
        const input = document.createElement("input");
        const marker = document.createElement("i");
        const copy = document.createElement("span");
        const name = document.createElement("strong");
        const description = document.createElement("small");
        const amount = document.createElement("b");
        input.type = "radio";
        input.name = "selected-service";
        input.value = service;
        input.dataset.price = price;
        input.id = `booking-service-${index}`;
        name.textContent = service;
        description.textContent = index === 0 ? "Professional visit and initial assessment" : "Labour price for this service";
        amount.textContent = price;
        copy.append(name, description);
        label.append(input, marker, copy, amount);
        input.addEventListener("change", () => {
            bookingPrice.textContent = price;
            bookingContinue.disabled = false;
        });
        return label;
    }));
    showBookingStep(1);
    bookingDialog.showModal();
}

document.querySelectorAll(".professional-card .primary-button").forEach(button => {
    button.addEventListener("click", event => {
        event.preventDefault();
        const card = button.closest(".professional-card");
        const profileLink = card.querySelector(".view-profile");
        const profile = providerProfiles[profileLink?.dataset.provider];
        if (profile) openBookingStep(profile);
    });
});

bookingNotes.addEventListener("input", () => {
    bookingNotesCount.textContent = String(bookingNotes.value.length);
});
bookingClose.addEventListener("click", () => bookingDialog.close());
bookingDialog.addEventListener("click", event => {
    if (event.target === bookingDialog) bookingDialog.close();
});
bookingForm.addEventListener("submit", event => {
    event.preventDefault();
    const selected = bookingForm.elements["selected-service"];
    if (!selected?.value || !bookingProfile) return;
    const selectedInput = bookingForm.querySelector('input[name="selected-service"]:checked');
    bookingDraft = {
        provider: bookingProfile.name,
        serviceType: bookingProfile.type,
        service: selected.value,
        price: selectedInput.dataset.price,
        notes: bookingNotes.value.trim(),
        urgent: document.getElementById("booking-urgent").checked
    };
    sessionStorage.setItem("localConnectBookingDraft", JSON.stringify(bookingDraft));
    showBookingStep(2);
});

scheduleForm.addEventListener("submit", event => {
    event.preventDefault();
    const date = scheduleForm.elements["booking-date"].value;
    const time = scheduleForm.elements["booking-time"].value;
    if (!date || !time) {
        scheduleForm.reportValidity();
        return;
    }
    bookingDraft.date = date;
    bookingDraft.time = time;
    showBookingStep(3);
});

addressForm.addEventListener("submit", event => {
    event.preventDefault();
    if (!addressForm.reportValidity()) return;
    const values = Object.fromEntries(new FormData(addressForm).entries());
    bookingDraft.customer = values.customerName;
    bookingDraft.phone = values.phone;
    bookingDraft.address = `${values.street}, ${values.area}, ${values.city}, ${values.state} ${values.pin}`;
    bookingDraft.addressLabel = values.addressLabel;
    bookingDraft.landmark = values.landmark || "";
    if (addressForm.elements.saveAddress.checked) localStorage.setItem("localConnectSavedAddress", JSON.stringify(values));
    renderBookingReview();
    showBookingStep(4);
});

function createReviewRow(label, value) {
    const row = document.createElement("div");
    const small = document.createElement("small");
    const strong = document.createElement("strong");
    small.textContent = label;
    strong.textContent = value;
    row.append(small, strong);
    return row;
}

function renderBookingReview() {
    const dateText = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${bookingDraft.date}T12:00:00`));
    const serviceFee = Number(bookingDraft.price.replace(/[^\d]/g, ""));
    bookingDraft.platformFee = 29;
    bookingDraft.total = serviceFee + bookingDraft.platformFee;
    document.getElementById("booking-review-details").replaceChildren(
        createReviewRow("Professional", bookingDraft.provider),
        createReviewRow("Service", bookingDraft.service),
        createReviewRow("Schedule", `${dateText}, ${bookingDraft.time}`),
        createReviewRow("Address", bookingDraft.address),
        createReviewRow("Service price", bookingDraft.price),
        createReviewRow("Platform fee", "₹29"),
        createReviewRow("Estimated total", `₹${bookingDraft.total.toLocaleString("en-IN")}`)
    );
}

reviewForm.addEventListener("submit", event => {
    event.preventDefault();
    if (!reviewForm.reportValidity()) return;
    bookingDraft.payment = reviewForm.elements.payment.value;
    bookingDraft.id = `LC${Date.now().toString().slice(-8)}`;
    bookingDraft.status = "Requested";
    bookingDraft.createdAt = new Date().toISOString();
    const bookings = JSON.parse(localStorage.getItem("localConnectBookings") || "[]");
    bookings.unshift(bookingDraft);
    localStorage.setItem("localConnectBookings", JSON.stringify(bookings));
    document.getElementById("booking-receipt").replaceChildren(
        createReviewRow("Booking ID", bookingDraft.id),
        createReviewRow("Service", bookingDraft.service),
        createReviewRow("Professional", bookingDraft.provider),
        createReviewRow("Date and time", `${bookingDraft.date} · ${bookingDraft.time}`),
        createReviewRow("Estimated total", `₹${bookingDraft.total.toLocaleString("en-IN")}`),
        createReviewRow("Payment", bookingDraft.payment),
        createReviewRow("Status", bookingDraft.status)
    );
    showBookingStep(5);
});

document.querySelectorAll("[data-booking-back]").forEach(button => {
    button.addEventListener("click", () => showBookingStep(Number(button.dataset.bookingBack)));
});
document.getElementById("booking-finish").addEventListener("click", () => bookingDialog.close());

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

categoryChips.forEach(chip => {
    chip.addEventListener("click", event => {
        const url = new URL(chip.href, window.location.href);
        const service = url.searchParams.get("service");
        if (!service) return;

        event.preventDefault();
        categoryChips.forEach(item => item.classList.toggle("is-selected", item === chip));
        search.value = service.replaceAll("-", " ");
        const matchingCategory = serviceCards.find(card => matchesService(card, search.value));
        if (matchingCategory) openCategoryDetails(matchingCategory);
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
