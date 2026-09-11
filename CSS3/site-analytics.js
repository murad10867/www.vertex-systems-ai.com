// Vertex Systems AI - first-party + Mixpanel analytics
(function () {
    "use strict";

    const ENDPOINT =
        "https://fkpjawyuyzgtjceymnal.supabase.co/functions/v1/vertex-analytics";

    // Mixpanel project token is a public client-side identifier, not a secret.
    const MIXPANEL_TOKEN = "1539d11e2295";
    const MIXPANEL_API_HOST = "https://api-eu.mixpanel.com";

    function uuid() {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
            return window.crypto.randomUUID();
        }

        return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, function (c) {
            const n = Number(c);
            const r = window.crypto && window.crypto.getRandomValues
                ? window.crypto.getRandomValues(new Uint8Array(1))[0]
                : Math.floor(Math.random() * 256);
            return (n ^ (r & (15 >> (n / 4)))).toString(16);
        });
    }

    function storageId(storage, key) {
        try {
            let value = storage.getItem(key);
            if (!value) {
                value = uuid();
                storage.setItem(key, value);
            }
            return value;
        } catch (_) {
            return uuid();
        }
    }

    function deviceType() {
        const ua = navigator.userAgent || "";
        const width = Math.max(
            document.documentElement ? document.documentElement.clientWidth : 0,
            window.innerWidth || 0
        );

        if (/ipad|tablet|playbook|silk/i.test(ua) || (width >= 700 && width <= 1100 && /android|mobile/i.test(ua))) {
            return "tablet";
        }

        if (/mobi|android|iphone|ipod/i.test(ua) || width < 700) {
            return "mobile";
        }

        return "desktop";
    }

    function referrerHost() {
        try {
            if (!document.referrer) return null;
            const host = new URL(document.referrer).hostname;
            return host === location.hostname ? "direct/internal" : host;
        } catch (_) {
            return null;
        }
    }

    const payload = {
        page_path: location.pathname,
        page_title: document.title || null,
        visitor_id: storageId(localStorage, "vertexVisitorId"),
        session_id: storageId(sessionStorage, "vertexSessionId"),
        device_type: deviceType(),
        referrer_host: referrerHost(),
        language: navigator.language || null,
        screen_width: Math.round(window.screen && window.screen.width ? window.screen.width : window.innerWidth || 0)
    };

    async function sessionInfo() {
        try {
            if (!window.supabaseClient || !window.supabaseClient.auth) {
                return { token: null, user: null };
            }

            const result = await window.supabaseClient.auth.getSession();
            const session = result && result.data ? result.data.session : null;

            return {
                token: session ? session.access_token : null,
                user: session ? session.user : null
            };
        } catch (_) {
            return { token: null, user: null };
        }
    }

    async function sendFirstPartyAnalytics(info) {
        const headers = { "Content-Type": "application/json" };
        if (info && info.token) headers.Authorization = "Bearer " + info.token;

        fetch(ENDPOINT, {
            method: "POST",
            mode: "cors",
            credentials: "omit",
            keepalive: true,
            headers: headers,
            body: JSON.stringify(payload)
        }).catch(function () {
            // Analytics must never affect the user experience.
        });
    }

    function installMixpanelSnippet() {
        const current = window.mixpanel;
        if (current && current.__SV) return;

        const b = current || [];
        window.mixpanel = b;
        b._i = [];

        b.init = function (token, config, name) {
            function makeMethod(target, method) {
                const parts = method.split(".");
                if (parts.length === 2) {
                    target = target[parts[0]];
                    method = parts[1];
                }
                target[method] = function () {
                    target.push([method].concat(Array.prototype.slice.call(arguments, 0)));
                };
            }

            let instance = b;
            if (typeof name !== "undefined") {
                instance = b[name] = [];
            } else {
                name = "mixpanel";
            }

            instance.people = instance.people || [];
            instance.toString = function (stub) {
                let label = "mixpanel";
                if (name !== "mixpanel") label += "." + name;
                if (!stub) label += " (stub)";
                return label;
            };
            instance.people.toString = function () {
                return instance.toString(1) + ".people (stub)";
            };

            const methods = (
                "disable time_event track track_pageview track_links track_forms track_with_groups " +
                "add_group set_group remove_group register register_once alias unregister identify name_tag " +
                "set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking " +
                "clear_opt_in_out_tracking start_batch_senders people.set people.set_once people.unset " +
                "people.increment people.append people.union people.track_charge people.clear_charges " +
                "people.delete_user people.remove"
            ).split(" ");

            for (let i = 0; i < methods.length; i++) {
                makeMethod(instance, methods[i]);
            }

            const groupMethods = "set set_once union unset remove delete".split(" ");
            instance.get_group = function () {
                const group = {};
                const groupArgs = ["get_group"].concat(Array.prototype.slice.call(arguments, 0));
                for (let i = 0; i < groupMethods.length; i++) {
                    const method = groupMethods[i];
                    group[method] = function () {
                        instance.push([groupArgs, [method].concat(Array.prototype.slice.call(arguments, 0))]);
                    };
                }
                return group;
            };

            b._i.push([token, config, name]);
        };

        b.__SV = 1.2;

        const script = document.createElement("script");
        script.type = "text/javascript";
        script.async = true;
        script.src = "https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js";
        script.dataset.vertexMixpanel = "1";
        script.onerror = function () {
            // Mixpanel failure must never affect Vertex.
        };

        const firstScript = document.getElementsByTagName("script")[0];
        if (firstScript && firstScript.parentNode) {
            firstScript.parentNode.insertBefore(script, firstScript);
        } else {
            document.head.appendChild(script);
        }
    }

    function loadMixpanel(info) {
        try {
            installMixpanelSnippet();
            if (!window.mixpanel || typeof window.mixpanel.init !== "function") return;
            if (window.__vertexMixpanelReady) return;

            window.mixpanel.init(MIXPANEL_TOKEN, {
                api_host: MIXPANEL_API_HOST,
                persistence: "localStorage",
                autocapture: false,
                track_pageview: false,
                debug: false
            });

            window.__vertexMixpanelReady = true;

            if (info && info.user && info.user.id) {
                window.mixpanel.identify(info.user.id);
                window.mixpanel.people.set({
                    "Registered User": true
                });
            }

            window.mixpanel.track("Page Viewed", {
                "Page Path": payload.page_path,
                "Page Title": payload.page_title,
                "Device Type": payload.device_type,
                "Referrer Host": payload.referrer_host || "direct",
                "Language": payload.language || "unknown",
                "Signed In": !!(info && info.user)
            });

            const path = String(payload.page_path || "").toLowerCase();
            if (/\/ai\.html$/.test(path)) {
                window.mixpanel.track("Vertex AI Opened", {
                    "Signed In": !!(info && info.user)
                });
            }
        } catch (_) {
            // Analytics must never affect the user experience.
        }
    }

    async function send() {
        const info = await sessionInfo();
        sendFirstPartyAnalytics(info);
        loadMixpanel(info);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", send, { once: true });
    } else {
        send();
    }
})();
