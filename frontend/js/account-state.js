const RESOURCE_STORAGE = {
    addresses: "localConnectAddresses",
    bookings: "localConnectBookings",
    favourites: "localConnectFavourites",
    profile: "localConnectProfile",
    settings: "localConnectSettings"
};

let sessionPromise;
const pendingSyncs = new Map();

async function request(path, options = {}) {
    const response = await fetch(path, {
        credentials: "same-origin",
        ...options,
        headers: {
            Accept: "application/json",
            "X-Requested-With": "LocalConnect",
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...options.headers
        }
    });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Account sync failed.");
    return data;
}

export function getAccountSession(refresh = false) {
    if (refresh || !sessionPromise) {
        sessionPromise = request("/api/session").catch(() => ({ authenticated: false }));
    }
    return sessionPromise;
}

function readLocal(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? undefined : JSON.parse(raw);
    } catch {
        return undefined;
    }
}

export async function hydrateAccountState() {
    const account = await getAccountSession(true);
    if (!account.authenticated) return account;

    const state = await request("/api/me/state");
    const resources = state.resources || {};
    for (const [resource, storageKey] of Object.entries(RESOURCE_STORAGE)) {
        const serverValue = resources[resource]?.value;
        const localValue = readLocal(storageKey);
        if (serverValue !== undefined) {
            localStorage.setItem(storageKey, JSON.stringify(serverValue));
        } else if (localValue !== undefined) {
            await syncResource(resource, localValue);
        }
    }

    const profile = {
        ...(readLocal(RESOURCE_STORAGE.profile) || {}),
        name: account.user.name,
        email: account.user.email
    };
    localStorage.setItem(RESOURCE_STORAGE.profile, JSON.stringify(profile));
    localStorage.setItem("localConnectUser", account.user.name);
    await syncResource("profile", profile);
    return account;
}

export function syncResource(resource, value) {
    if (!RESOURCE_STORAGE[resource]) return Promise.resolve(false);
    const previous = pendingSyncs.get(resource) || Promise.resolve();
    const next = previous
        .catch(() => undefined)
        .then(async () => {
            const account = await getAccountSession();
            if (!account.authenticated) return false;
            await request(`/api/me/state/${resource}`, {
                method: "PUT",
                body: JSON.stringify({ value })
            });
            return true;
        });
    pendingSyncs.set(resource, next);
    return next.finally(() => {
        if (pendingSyncs.get(resource) === next) pendingSyncs.delete(resource);
    });
}

export async function clearAccountState() {
    const account = await getAccountSession();
    if (!account.authenticated) return;
    await Promise.all(Object.keys(RESOURCE_STORAGE).map(resource =>
        request(`/api/me/state/${resource}`, { method: "DELETE" })
    ));
}

export async function logoutAccount() {
    await request("/api/logout", { method: "POST" }).catch(() => undefined);
    sessionPromise = Promise.resolve({ authenticated: false });
}

export function resourceForStorageKey(key) {
    return Object.entries(RESOURCE_STORAGE).find(([, storageKey]) => storageKey === key)?.[0];
}
