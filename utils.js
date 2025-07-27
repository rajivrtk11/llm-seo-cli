import 'dotenv/config';
import fetch from 'node-fetch';

async function getWSUrl() {
    const isProd = process.env.NODE_ENV === 'production'; // or use your own flag
    const token = process.env.BROWSERLESS_TOKEN; // required for production

    let wsEndpoint;

    if (isProd) {
        if (!token) {
            throw new Error("Missing BROWSERLESS_TOKEN in production.");
        }
        wsEndpoint = `wss://production-sfo.browserless.io/chromium?token=${token}&proxy=residential&stealth=true`;
    } else {
        wsEndpoint = await getWebSocketDebuggerUrlForLocal();
    }

    return wsEndpoint;
}

async function getWebSocketDebuggerUrlForLocal() {
    const response = await fetch('http://127.0.0.1:9222/json/version');
    const data = await response.json();
    return data.webSocketDebuggerUrl;
}

export { getWSUrl }