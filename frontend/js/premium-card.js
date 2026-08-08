const featuredServices = [
    {
        image: "/assets/services/ac-repair.png",
        imageAlt: "Local AC technician inspecting a wall-mounted air conditioner",
        category: "Appliance Repair",
        title: "Complete AC Care",
        professional: "CoolCare Services",
        rating: "4.8",
        reviews: "118",
        distance: "4.8 km",
        price: "₹499",
        arrival: "45 min",
        jobs: "620+",
        buttonUrl: "/pages/home.html?service=ac-repair"
    },
    {
        image: "/assets/services/plumber.png",
        imageAlt: "Professional plumber repairing pipework beneath a kitchen sink",
        category: "Plumbing",
        title: "Expert Plumbing",
        professional: "Sri Sai Plumbing Works",
        rating: "4.9",
        reviews: "126",
        distance: "2.1 km",
        price: "₹299",
        arrival: "35 min",
        jobs: "840+",
        buttonUrl: "/pages/home.html?service=plumber"
    },
    {
        image: "/assets/services/electrician.png",
        imageAlt: "Qualified electrician inspecting a residential electrical panel",
        category: "Electrical",
        title: "Safe Electricals",
        professional: "Davangere Electricals",
        rating: "4.9",
        reviews: "174",
        distance: "3.2 km",
        price: "₹349",
        arrival: "50 min",
        jobs: "710+",
        buttonUrl: "/pages/home.html?service=electrician"
    },
    {
        image: "/assets/services/cleaning.png",
        imageAlt: "Home cleaning professional carefully wiping a living-room table",
        category: "Home Cleaning",
        title: "Premium Cleaning",
        professional: "NeatNest Home Care",
        rating: "4.7",
        reviews: "203",
        distance: "1.8 km",
        price: "₹599",
        arrival: "60 min",
        jobs: "960+",
        buttonUrl: "/pages/home.html?service=cleaning"
    },
    {
        image: "/assets/services/car-mechanic.png",
        imageAlt: "Professional car mechanic diagnosing a vehicle in a clean workshop",
        category: "Vehicle Repair",
        title: "Complete Car Care",
        professional: "RK Motors & Service",
        rating: "4.8",
        reviews: "91",
        distance: "5.6 km",
        price: "₹499",
        arrival: "40 min",
        jobs: "530+",
        buttonUrl: "/pages/home.html?service=car-mechanic"
    },
    {
        image: "/assets/services/bike-mechanic.png",
        imageAlt: "Experienced bike mechanic servicing a motorcycle engine",
        category: "Vehicle Repair",
        title: "Bike Service Pro",
        professional: "TwoWheel Garage",
        rating: "4.7",
        reviews: "86",
        distance: "2.7 km",
        price: "₹399",
        arrival: "30 min",
        jobs: "480+",
        buttonUrl: "/pages/home.html?service=bike-mechanic"
    }
];

function createSvgElement(name, attributes = {}) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
}

function createServiceCard(data) {
    const card = document.createElement("article");
    card.className = "premium-service-card is-loading";

    const media = document.createElement("div");
    media.className = "premium-card-media";

    const image = document.createElement("img");
    image.className = "premium-card-image";
    image.src = data.image;
    image.alt = data.imageAlt;
    image.width = 560;
    image.height = 380;
    image.loading = "lazy";
    image.decoding = "async";
    const finishLoading = () => card.classList.remove("is-loading");
    image.addEventListener("load", finishLoading, { once: true });
    image.addEventListener("error", finishLoading, { once: true });
    if (image.complete) queueMicrotask(finishLoading);

    const category = document.createElement("span");
    category.className = "premium-card-badge";
    category.textContent = data.category;

    const favourite = document.createElement("button");
    favourite.className = "premium-favourite";
    favourite.type = "button";
    favourite.setAttribute("aria-label", `Save ${data.title} to favourites`);
    favourite.setAttribute("aria-pressed", "false");
    const heart = createSvgElement("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" });
    heart.appendChild(createSvgElement("path", { d: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" }));
    favourite.appendChild(heart);
    favourite.addEventListener("click", event => {
        event.stopPropagation();
        const saved = favourite.classList.toggle("is-saved");
        favourite.setAttribute("aria-pressed", String(saved));
        favourite.setAttribute("aria-label", `${saved ? "Remove" : "Save"} ${data.title} ${saved ? "from" : "to"} favourites`);
    });

    const mediaActions = document.createElement("div");
    mediaActions.className = "premium-card-actions";
    mediaActions.append(category, favourite);
    media.append(image, mediaActions);

    const content = document.createElement("div");
    content.className = "premium-card-content";
    const verified = document.createElement("span");
    verified.className = "premium-verified";
    verified.innerHTML = '<span aria-hidden="true">✓</span> Verified';

    const title = document.createElement("h3");
    title.textContent = data.title;
    const professional = document.createElement("p");
    professional.className = "premium-professional";
    professional.textContent = data.professional;

    const ratingRow = document.createElement("div");
    ratingRow.className = "premium-rating-row";
    ratingRow.innerHTML = `<strong>★ ${data.rating}</strong><span>${data.reviews} reviews</span><i aria-hidden="true"></i><span>${data.distance}</span>`;

    const stats = document.createElement("div");
    stats.className = "premium-card-stats";
    [
        ["From", data.price],
        ["Arrival", data.arrival],
        ["Jobs", data.jobs]
    ].forEach(([label, value]) => {
        const stat = document.createElement("span");
        stat.innerHTML = `<small>${label}</small><strong>${value}</strong>`;
        stats.appendChild(stat);
    });

    const cta = document.createElement("a");
    cta.className = "premium-card-cta";
    cta.href = data.buttonUrl;
    cta.textContent = "Book Now";
    cta.addEventListener("click", event => {
        if (cta.classList.contains("is-loading")) {
            event.preventDefault();
            return;
        }
        event.preventDefault();
        const destination = cta.href;
        cta.classList.add("is-loading");
        cta.setAttribute("aria-disabled", "true");
        cta.innerHTML = '<span class="button-spinner" aria-hidden="true"></span><span>Booking…</span>';
        window.setTimeout(() => {
            cta.classList.remove("is-loading");
            cta.classList.add("is-success");
            cta.innerHTML = '<span aria-hidden="true">✓</span><span>Ready</span>';
            window.setTimeout(() => {
                window.location.href = destination;
            }, 450);
        }, 650);
    });

    content.append(verified, title, professional, ratingRow, stats, cta);
    card.append(media, content);
    return card;
}

const premiumCardMount = document.getElementById("premium-service-card");

if (premiumCardMount) {
    const abortController = new AbortController();
    const { signal } = abortController;
    const carousel = document.createElement("div");
    carousel.className = "premium-carousel";
    carousel.tabIndex = 0;
    carousel.setAttribute("role", "region");
    carousel.setAttribute("aria-roledescription", "carousel");
    carousel.setAttribute("aria-label", "Featured local services");

    const viewport = document.createElement("div");
    viewport.className = "premium-carousel-viewport";
    const stage = document.createElement("div");
    stage.className = "premium-carousel-stage";

    [featuredServices.at(-1), featuredServices[0], featuredServices[1]].forEach(service => {
        const preload = document.createElement("link");
        preload.rel = "preload";
        preload.as = "image";
        preload.href = service.image;
        document.head.appendChild(preload);
    });

    featuredServices.forEach((service, index) => {
        const slide = document.createElement("div");
        slide.className = "premium-carousel-slide";
        slide.dataset.index = String(index);
        slide.setAttribute("role", "group");
        slide.setAttribute("aria-label", `${index + 1} of ${featuredServices.length}`);
        slide.appendChild(createServiceCard(service));
        stage.appendChild(slide);
    });
    viewport.appendChild(stage);

    const previous = document.createElement("button");
    previous.className = "premium-carousel-button premium-carousel-previous";
    previous.type = "button";
    previous.setAttribute("aria-label", "Previous featured service");
    previous.innerHTML = '<span aria-hidden="true">‹</span>';

    const next = document.createElement("button");
    next.className = "premium-carousel-button premium-carousel-next";
    next.type = "button";
    next.setAttribute("aria-label", "Next featured service");
    next.innerHTML = '<span aria-hidden="true">›</span>';

    const dots = document.createElement("div");
    dots.className = "premium-carousel-dots";
    dots.setAttribute("aria-label", "Choose a featured service");

    carousel.append(viewport, previous, next, dots);
    premiumCardMount.appendChild(carousel);

    const slides = [...stage.children];
    let activeIndex = 0;
    let autoplayTimer;
    let resumeTimer;
    let pointerState = null;
    let dragFrame;
    let pendingDragX = 0;
    let isHovering = false;
    const autoplayDelay = 2000;
    const interactionResumeDelay = 1500;
    const stateClasses = ["active-center", "side-near-left", "side-near-right", "side-far-left", "side-far-right", "offscreen"];

    featuredServices.forEach((service, index) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.setAttribute("aria-label", `Show ${service.title}`);
        dot.addEventListener("click", () => showService(index), { signal });
        dots.appendChild(dot);
    });

    function circularDistance(index) {
        let distance = index - activeIndex;
        const halfway = featuredServices.length / 2;
        if (distance > halfway) distance -= featuredServices.length;
        if (distance < -halfway) distance += featuredServices.length;
        return distance;
    }

    function stateForDistance(distance) {
        if (distance === 0) return "active-center";
        if (distance === -1) return "side-near-left";
        if (distance === 1) return "side-near-right";
        if (distance === -2) return "side-far-left";
        if (distance === 2) return "side-far-right";
        return "offscreen";
    }

    function updateCarousel() {
        [...dots.children].forEach((dot, index) => {
            const active = index === activeIndex;
            dot.classList.toggle("active", active);
            dot.setAttribute("aria-current", active ? "true" : "false");
        });
        slides.forEach((slide, index) => {
            const state = stateForDistance(circularDistance(index));
            const active = state === "active-center";
            slide.classList.remove(...stateClasses);
            slide.classList.add(state);
            slide.setAttribute("aria-hidden", active ? "false" : "true");
            slide.inert = !active;
        });
    }

    function showService(index, resumeDelay = autoplayDelay) {
        if (index === activeIndex) {
            scheduleAutoplay(resumeDelay);
            return;
        }
        activeIndex = (index + featuredServices.length) % featuredServices.length;
        carousel.classList.add("is-sliding");
        updateCarousel();
        window.setTimeout(() => carousel.classList.remove("is-sliding"), 650);
        scheduleAutoplay(resumeDelay);
    }

    function goPrevious() {
        showService(activeIndex - 1);
    }

    function goNext(delay = autoplayDelay) {
        showService(activeIndex + 1, delay);
    }

    function pauseAutoplay() {
        window.clearTimeout(autoplayTimer);
        window.clearTimeout(resumeTimer);
    }

    function scheduleAutoplay(delay = autoplayDelay) {
        pauseAutoplay();
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reducedMotion || document.hidden || isHovering || pointerState) return;
        autoplayTimer = window.setTimeout(() => goNext(autoplayDelay), delay);
    }

    function resumeAfterInteraction() {
        pauseAutoplay();
        resumeTimer = window.setTimeout(() => scheduleAutoplay(autoplayDelay), interactionResumeDelay);
    }

    function renderDrag() {
        const resisted = Math.sign(pendingDragX) * Math.min(Math.abs(pendingDragX) * .82, 105);
        stage.style.transform = `translate3d(${resisted}px, 0, 0)`;
        dragFrame = undefined;
    }

    function resetDragPosition() {
        if (dragFrame) window.cancelAnimationFrame(dragFrame);
        stage.style.transform = "translate3d(0, 0, 0)";
        dragFrame = undefined;
    }

    slides.forEach((slide, index) => {
        slide.addEventListener("click", () => {
            if (index !== activeIndex) showService(index);
        }, { signal });
    });
    previous.addEventListener("click", goPrevious, { signal });
    next.addEventListener("click", () => goNext(), { signal });
    const hoverPauseSelector = ".active-center .premium-service-card, .premium-carousel-button, .premium-carousel-dots";
    carousel.addEventListener("pointerover", event => {
        if (!event.target.closest(hoverPauseSelector)) return;
        isHovering = true;
        pauseAutoplay();
    }, { signal });
    carousel.addEventListener("pointerout", event => {
        if (!event.target.closest(hoverPauseSelector)) return;
        if (event.relatedTarget?.closest?.(hoverPauseSelector)) return;
        isHovering = false;
        resumeAfterInteraction();
    }, { signal });
    carousel.addEventListener("focusin", pauseAutoplay, { signal });
    carousel.addEventListener("focusout", event => {
        if (!carousel.contains(event.relatedTarget)) resumeAfterInteraction();
    }, { signal });
    carousel.addEventListener("keydown", event => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            event.key === "ArrowLeft" ? goPrevious() : goNext();
        }
    }, { signal });

    viewport.addEventListener("pointerdown", event => {
        if (event.button !== 0) return;
        pointerState = {
            id: event.pointerId,
            startX: event.clientX,
            lastX: event.clientX,
            lastTime: performance.now(),
            velocity: 0
        };
        viewport.setPointerCapture(event.pointerId);
        viewport.classList.add("is-swiping");
        carousel.classList.add("is-dragging");
        pauseAutoplay();
    }, { signal });
    viewport.addEventListener("pointermove", event => {
        if (!pointerState || event.pointerId !== pointerState.id) return;
        const now = performance.now();
        const elapsed = Math.max(now - pointerState.lastTime, 1);
        pointerState.velocity = (event.clientX - pointerState.lastX) / elapsed;
        pointerState.lastX = event.clientX;
        pointerState.lastTime = now;
        pendingDragX = event.clientX - pointerState.startX;
        if (!dragFrame) dragFrame = window.requestAnimationFrame(renderDrag);
    }, { signal });
    viewport.addEventListener("pointerup", event => {
        if (!pointerState || event.pointerId !== pointerState.id) return;
        const distance = event.clientX - pointerState.startX;
        const velocity = pointerState.velocity;
        pointerState = null;
        viewport.classList.remove("is-swiping");
        carousel.classList.remove("is-dragging");
        resetDragPosition();
        if (Math.abs(distance) > 60 || Math.abs(velocity) > .55) {
            const direction = Math.abs(velocity) > .55 ? velocity : distance;
            const postSwipeDelay = interactionResumeDelay + autoplayDelay;
            direction > 0 ? showService(activeIndex - 1, postSwipeDelay) : showService(activeIndex + 1, postSwipeDelay);
        } else {
            resumeAfterInteraction();
        }
    }, { signal });
    viewport.addEventListener("pointercancel", () => {
        pointerState = null;
        viewport.classList.remove("is-swiping");
        carousel.classList.remove("is-dragging");
        resetDragPosition();
        resumeAfterInteraction();
    }, { signal });
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            pauseAutoplay();
        } else {
            scheduleAutoplay(interactionResumeDelay);
        }
    }, { signal });
    window.addEventListener("pageshow", event => {
        if (event.persisted) scheduleAutoplay(interactionResumeDelay);
    }, { signal });
    window.addEventListener("pagehide", event => {
        pauseAutoplay();
        if (dragFrame) window.cancelAnimationFrame(dragFrame);
        if (!event.persisted) abortController.abort();
    }, { signal });

    updateCarousel();
    scheduleAutoplay();
}
