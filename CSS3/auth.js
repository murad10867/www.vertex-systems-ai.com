// ==========================================
// Vertex Authentication System
// Supabase Edition
// ==========================================

"use strict";

const VertexAuth = {
    protectedPages: [
        "dashboard.html",
        "projects.html",
        "ai.html",
        "api-key.html",
        "robots.html",
        "games.html",
        "web.html",
        "space.html",
        "minecraft.html",
        "planets.html",
        "stars.html",
        "black-holes.html",
        "galaxies.html",
        "moons.html",
        "exploration.html",
        "check.html",
        "checkout.html",
        "payment-result.html"
    ],

    _session: null,
    _user: null,
    _ready: false,
    _checking: true,
    _initPromise: null,
    _authSubscription: null,

    getCurrentPage() {
        const path = window.location.pathname;
        return path.split("/").pop() || "index.html";
    },

    isProtectedPage(page) {
        return this.protectedPages.includes(page);
    },

    getSupabaseClient() {
        if (window.supabaseClient?.auth) return window.supabaseClient;

        try {
            if (typeof supabaseClient !== "undefined" && supabaseClient?.auth) {
                return supabaseClient;
            }
        } catch (_) {
            // Supabase config has not loaded yet.
        }

        return null;
    },

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const absoluteURL = new URL(src, window.location.href).href;
            const existing = Array.from(document.scripts).find(
                (script) => script.src === absoluteURL
            );

            if (existing) {
                if (src.includes("@supabase/supabase-js") && window.supabase) {
                    resolve();
                    return;
                }

                if (src.includes("supabase-config.js") && this.getSupabaseClient()) {
                    resolve();
                    return;
                }

                existing.addEventListener("load", resolve, { once: true });
                existing.addEventListener(
                    "error",
                    () => reject(new Error("تعذر تحميل: " + src)),
                    { once: true }
                );
                return;
            }

            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.onload = resolve;
            script.onerror = () => reject(new Error("تعذر تحميل: " + src));
            document.head.appendChild(script);
        });
    },

    async ensureSupabase() {
        if (!window.supabase) {
            await this.loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
        }

        if (!this.getSupabaseClient()) {
            await this.loadScript("supabase-config.js");
        }

        const client = this.getSupabaseClient();
        if (!client) {
            throw new Error("لم يتم العثور على Supabase client.");
        }

        return client;
    },

    normalizeUser(user) {
        if (!user) return null;

        const metadata = user.user_metadata || {};
        const email = user.email || "";
        const name =
            metadata.name ||
            metadata.full_name ||
            metadata.display_name ||
            (email ? email.split("@")[0] : "مستخدم Vertex");

        return {
            id: user.id,
            name,
            email,
            emailConfirmed: Boolean(user.email_confirmed_at),
            createdAt: user.created_at || null
        };
    },

    applySession(session) {
        this._session = session || null;
        this._user = session?.user ? this.normalizeUser(session.user) : null;
        this._ready = true;
        this._checking = false;
        this.clearLegacySession();
        this.dispatchAuthReady();
    },

    isReady() {
        return this._ready;
    },

    whenReady() {
        return this.init();
    },

    getSession() {
        return this._session;
    },

    async getSessionAsync() {
        const client = await this.ensureSupabase();
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        this.applySession(data.session);
        return data.session;
    },

    isLoggedIn() {
        // توافق مؤقت مع ملفات Vertex القديمة التي تفحص الحالة فور تحميلها.
        // الصفحة نفسها تبقى مخفية حتى تنتهي requireAuth من التحقق الحقيقي.
        if (this._checking && !this._ready) return true;
        return Boolean(this._session?.user);
    },

    getUser() {
        return this._user;
    },

    getUserName() {
        return this._user?.name || "";
    },

    getUserEmail() {
        return this._user?.email || "";
    },

    rememberCurrentPage() {
        const page = this.getCurrentPage();
        if (!this.isProtectedPage(page)) return;
        localStorage.setItem("vertexReturnPage", page);
    },

    showProtectedPage() {
        document.documentElement.classList.add("vertex-authenticated");
    },

    hideProtectedPage() {
        document.documentElement.classList.remove("vertex-authenticated");
    },

    async requireAuth() {
        const page = this.getCurrentPage();

        if (!this.isProtectedPage(page)) {
            this._ready = true;
            this._checking = false;
            this.showProtectedPage();
            return true;
        }

        try {
            const client = await this.ensureSupabase();
            const sessionResult = await client.auth.getSession();
            if (sessionResult.error) throw sessionResult.error;

            const session = sessionResult.data.session;
            if (!session?.user) {
                this.applySession(null);
                this.rememberCurrentPage();
                window.location.replace("login.html");
                return false;
            }

            // تحقق من المستخدم عبر خادم Supabase، وليس من التخزين المحلي فقط.
            const userResult = await client.auth.getUser();
            if (userResult.error || !userResult.data?.user) {
                throw userResult.error || new Error("تعذر التحقق من المستخدم.");
            }

            const verifiedSession = {
                ...session,
                user: userResult.data.user
            };

            this.applySession(verifiedSession);
            this.showProtectedPage();
            return true;
        } catch (error) {
            console.error("Vertex Auth Error:", error);
            this._session = null;
            this._user = null;
            this._ready = true;
            this._checking = false;
            this.rememberCurrentPage();
            window.location.replace("login.html");
            return false;
        }
    },

    async refreshSession() {
        try {
            const client = await this.ensureSupabase();
            const { data, error } = await client.auth.refreshSession();
            if (error) throw error;
            this.applySession(data.session);
            return Boolean(data.session?.user);
        } catch (error) {
            console.error("Vertex Refresh Error:", error);
            return false;
        }
    },

    async refreshUser() {
        try {
            const client = await this.ensureSupabase();
            const { data, error } = await client.auth.getUser();
            if (error) throw error;

            if (data?.user) {
                this._user = this.normalizeUser(data.user);
                if (this._session) this._session.user = data.user;
                this.dispatchAuthReady();
                return this._user;
            }

            return null;
        } catch (error) {
            console.error("Vertex User Error:", error);
            return null;
        }
    },

    clearLegacySession() {
        localStorage.removeItem("vertexSession");
    },

    async logout() {
        try {
            const client = await this.ensureSupabase();
            const { error } = await client.auth.signOut();
            if (error) throw error;
        } catch (error) {
            console.error("Vertex Logout Error:", error);
        }

        this._session = null;
        this._user = null;
        this._ready = true;
        this._checking = false;
        this.clearLegacySession();
        localStorage.removeItem("vertexRequestedSystem");
        localStorage.removeItem("vertexReturnPage");
        window.location.replace("login.html");
    },

    async listenToAuthChanges() {
        const client = await this.ensureSupabase();
        if (this._authSubscription) return;

        const { data } = client.auth.onAuthStateChange((event, session) => {
            this.applySession(session);

            const page = this.getCurrentPage();
            if (session?.user) {
                this.showProtectedPage();
                return;
            }

            if (this.isProtectedPage(page)) {
                this.rememberCurrentPage();
                window.location.replace("login.html");
            }
        });

        this._authSubscription = data?.subscription || null;
    },

    dispatchAuthReady() {
        document.dispatchEvent(
            new CustomEvent("vertex-auth-ready", {
                detail: {
                    loggedIn: Boolean(this._session?.user),
                    user: this._user
                }
            })
        );
    },

    async init() {
        if (this._initPromise) return this._initPromise;

        this._initPromise = (async () => {
            const allowed = await this.requireAuth();

            try {
                await this.listenToAuthChanges();
            } catch (error) {
                console.error("Vertex Auth Listener Error:", error);
            }

            return allowed && Boolean(this._session?.user || !this.isProtectedPage(this.getCurrentPage()));
        })();

        return this._initPromise;
    }
};

window.VertexAuth = VertexAuth;

(function startVertexAuth() {
    const currentPage = VertexAuth.getCurrentPage();

    if (VertexAuth.isProtectedPage(currentPage)) {
        const style = document.createElement("style");
        style.textContent = `
            html:not(.vertex-authenticated) body {
                visibility: hidden !important;
            }
        `;
        document.head.appendChild(style);
    }

    VertexAuth.init();
})();