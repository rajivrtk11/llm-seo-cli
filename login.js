import fs from 'fs';
import path from 'path';

const EMAIL = 'rajivrtk02@gmail.com';
const PASSWORD = 'KkN!E.#R7NDH-6Nsdsds';

const screenshotDir = path.resolve('./screenshots');

if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir);
}

let step = 1;
async function takeScreenshot(page, label) {
    const fileName = `${String(step++).padStart(2, '0')}-${label}.png`;
    await page.screenshot({ path: path.join(screenshotDir, fileName), fullPage: true });
    console.log(`📸 Screenshot taken: ${fileName}`);
}

async function loginToChatGPT(page) {
    await takeScreenshot(page, 'loaded-login');

    // Type Email
    await page.waitForSelector('input[type="email"], input[placeholder="Email address"]');
    await page.type('input[type="email"], input[placeholder="Email address"]', EMAIL, { delay: 50 });
    await takeScreenshot(page, 'typed-email');

    // Click Continue after email
    await page.waitForSelector('button[type="submit"]');
    await page.click('button[type="submit"]');
    await new Promise(resolve => setTimeout(resolve, 1000));
    await takeScreenshot(page, 'after-email-continue');

    // Wait for password field
    await page.waitForSelector('input[type="password"], input[placeholder="Password"]', { timeout: 10000 });
    await page.type('input[type="password"], input[placeholder="Password"]', PASSWORD, { delay: 50 });
    await takeScreenshot(page, 'typed-password');

    // Final submit
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    await takeScreenshot(page, 'after-final-submit');

    console.log('✅ Login automation complete');
}

async function solveCloudflareCheckbox(page) {
    console.log("🔍 Attempting to solve Cloudflare checkbox...");

    // Find the iframe with the challenge
    const frames = page.frames();
    const cfFrame = frames.find(frame => frame.url().includes('challenge') || frame.url().includes('cloudflare'));

    if (!cfFrame) {
        console.log('❌ Cloudflare frame not found.');
        await page.browser().close(); // Make sure to call browser from page
        return;
    }

    console.log('✅ Cloudflare frame found:', cfFrame.url());

    try {
        // Inject turnstile override script into Cloudflare iframe
        await cfFrame.evaluate(() => {
            const i = setInterval(() => {
                if (window.turnstile) {
                    clearInterval(i);
                    window.turnstile.render = (a, b) => {
                        let p = {
                            method: "turnstile",
                            key: "YOUR_API_KEY", // Replace with your API key if needed
                            sitekey: b.sitekey,
                            pageurl: window.location.href,
                            data: b.cData,
                            pagedata: b.chlPageData,
                            action: b.action,
                            userAgent: navigator.userAgent,
                            json: 1
                        };
                        console.log('🔍 turnstile payload:', JSON.stringify(p));
                        window.tsCallback = b.callback;
                        return 'foo';
                    };
                }
            }, 50);
        });

        console.log("✅ Injected turnstile override.");

        // Optional: Also try clicking checkbox if visible
        const checkbox = await cfFrame.waitForSelector('input[type="checkbox"]', { timeout: 10000 });
        const checkboxBox = await checkbox.boundingBox();
        await page.mouse.move(checkboxBox.x + 5, checkboxBox.y + 5);
        await page.waitForTimeout(1000 + Math.random() * 1000);
        await checkbox.click({ delay: 150 });

        console.log("✅ Checkbox clicked.");
    } catch (e) {
        console.error("⚠️ Failed to inject or click Cloudflare checkbox:", e);
    }

    await new Promise(resolve => setTimeout(resolve, 5000));
}

export { loginToChatGPT, solveCloudflareCheckbox };
