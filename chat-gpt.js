import 'dotenv/config';
import fetch from 'node-fetch';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { loginToChatGPT, solveCloudflareCheckbox } from "./login.js";

const token = process.env.BROWSERLESS_TOKEN;
if (!token) throw new Error('❌ Missing BROWSERLESS_TOKEN in env');

// const prompt = "Suggest best phones under 50000 INR in 2025";
// const prompt = "Suggest me best shoes to buy in 2025";
const prompt = "What are the recent research findings on CRISPR gene editing in 2025?";
// const prompt = "Suggest me best saas product for reddit lead generation in 2025";
// const prompt = "Best lead generation tool in 2025"; // Change this to your desired prompt

const cookiesPath = path.resolve('./cookies.json');
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

async function getWebSocketEndpoint() {
    const url = `https://production-sfo.browserless.io/chrome/bql?token=${token}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: `mutation AskChatGPT {
            reconnect {
                    browserWSEndpoint
                }
            }`,
            operationName: "AskChatGPT",
            variables: {},
        }),
    });

    const json = await res.json();
    if (json.errors) {
        throw new Error('GraphQL Error: ' + JSON.stringify(json.errors, null, 2));
    }

    return json?.data?.reconnect?.browserWSEndpoint;
}

async function getWebSocketDebuggerUrlForLocal() {
    const response = await fetch('http://127.0.0.1:9222/json/version');
    const data = await response.json();
    return data.webSocketDebuggerUrl;
}

async function handleInput(page) {
    // Type prompt with human-like behavior
    // 🎯 Wait for the prompt input to appear
    const promptSelector = 'div.ProseMirror[contenteditable="true"]';
    await page.waitForSelector(promptSelector, { timeout: 10000 });

    // 🐭 Simulate human-like hesitation and movement near the input area
    const inputBox = await page.$(promptSelector);
    const box = await inputBox.boundingBox();

    for (let i = 0; i < 5; i++) {
        const x = box.x + Math.random() * box.width;
        const y = box.y + Math.random() * box.height;
        await page.mouse.move(x, y);
        await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 200));
    }

    // 🧍 Hover & pause like a human thinking
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1500)); // wait 1.5–3 sec

    // 🧠 Focus input and simulate typing
    await page.focus(promptSelector);
    await takeScreenshot(page, 'before-typing');

    for (const char of prompt) {
        await page.keyboard.type(char);
        await new Promise(resolve => setTimeout(resolve, Math.random() * 120 + 50)); // 50–170ms between keystrokes
    }

    await takeScreenshot(page, 'after-typing');
}

async function extractSources(page) {
    // Extract citation and "More" links
    const extraLinks = await page.evaluate(() => {
        const result = {
            citations: [],
            more: []
        };

        const extractLinks = (section) => {
            const links = [];
            const sectionElement = Array.from(document.querySelectorAll('li.border-token-border-light'))
                .find(el => el.innerText.trim() === section);
            if (!sectionElement) return links;

            const ul = sectionElement.nextElementSibling;
            if (!ul) return links;

            const items = ul.querySelectorAll('li > a');
            items.forEach(a => {
                const url = a.href;
                const source = a.querySelector('.text-xs')?.innerText?.trim();
                const title = a.querySelector('.font-semibold')?.innerText?.trim();
                const description = a.querySelector('.text-token-text-secondary')?.innerText?.trim();
                links.push({ url, source, title, description });
            });
            return links;
        };

        result.citations = extractLinks('Citations');
        result.more = extractLinks('More');

        return result;
    });

// 🖨️ Display formatted output
    if (extraLinks.citations.length || extraLinks.more.length) {
        console.log('\n🔗 Citations & More Links:\n');

        const printSection = (name, links) => {
            if (!links.length) return;
            console.log(`📚 ${name.toUpperCase()}:`);
            links.forEach((item, idx) => {
                console.log(`\n${idx + 1}. 🔗 [${item.title}](${item.url})`);
                console.log(`   🏷️ Source: ${item.source}`);
                if (item.description) {
                    console.log(`   📝 Description: ${item.description}`);
                }
            });
            console.log('\n');
        };

        printSection('Citations', extraLinks.citations);
        printSection('More', extraLinks.more);
    } else {
        console.log('ℹ️ No Citations or More links found.');
    }
}

async function getSources(page) {
    try {
        // const sourcesButtonSelector = 'button[aria-label="Sources"]';
        //
        // await page.waitForSelector(sourcesButtonSelector, {
        //     timeout: 5000,
        //     visible: true
        // });

        // const sourcesButton = await page.$(sourcesButtonSelector);
        await page.evaluate(() => {
            const btn = document.querySelector('.group\\/footnote');
            if (btn) {
                btn.click();
                console.log('✅ Clicked the Sources button');
            }
            else {
                console.log('❌ Sources button element was null');
            }
        });

        // if (btn) {
        //     btn.click();
        //     console.log('✅ Clicked the Sources button');
        //     await takeScreenshot(page, 'clicked-sources');
        //     await new Promise(resolve => setTimeout(resolve, 2000));
        // }

        // if (sourcesButton) {
        //     await sourcesButton.click();
        //     console.log('✅ Clicked the Sources button');
        //     await takeScreenshot(page, 'clicked-sources');
        //     await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for modal to open
        // }
        // else {
        //     console.log('❌ Sources button element was null');
        // }
    } catch (err) {
        console.log('❌ Failed to click Sources button:', err.message);
    }
}
async function runAutomation() {
    // let wsEndpoint = await getWebSocketEndpoint();
    // let wsEndpoint = `wss://production-sfo.browserless.io/chromium?token=${token}&proxy=residential&stealth=true`
    let wsEndpoint = await getWebSocketDebuggerUrlForLocal();
    console.log('✅ Got WebSocket endpoint:', wsEndpoint);

    let browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
    let page = await browser.newPage();

    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36');

    // Set cookies
    const cookies = JSON.parse(fs.readFileSync(cookiesPath));
    // await page.setCookie(...cookies);

    // Navigate to ChatGPT
    await page.goto('https://chatgpt.com/', {waitUntil: 'networkidle2'});
    await new Promise(resolve => setTimeout(resolve, 5000)); // wait for 2 seconds

    await takeScreenshot(page, 'opened-chatgpt');

    // Accept cookie if needed
    try {
        await page.waitForSelector('button:has-text("Reject non-essential")', {timeout: 3000});
        await page.click('button:has-text("Accept all")');
        console.log('✅ Accepted cookies');
        await takeScreenshot(page, 'accepted-cookies');
    } catch (_) {
        console.log('ℹ️ No cookie banner');
        await takeScreenshot(page, 'no-cookie-banner');
    }

    // Check if login is required
    const currentUrl = page.url();

    let isLoginPage = false;
    if (currentUrl.includes('/log-in') || currentUrl.includes('/login')) {
        console.log('🔐 On login page, performing random mouse movement and reloading...');

        // Perform random mouse movement
        isLoginPage = true;

        // reload the page multiple times with random mouse movements until login page goes away
        for (let i = 0; i < 5 && isLoginPage; i++) {
            // close existing browser session and wait for some time
            await browser.close();
            await new Promise(resolve => setTimeout(resolve, 5000*i));

            // start new session
            browser = await puppeteer.connect({browserWSEndpoint: wsEndpoint});
            page = await browser.newPage();

            await page.goto('https://chatgpt.com/', {waitUntil: 'networkidle2'});
            await new Promise(resolve => setTimeout(resolve, 5000)); // wait for 2 seconds

            await takeScreenshot(page, 'opened-chatgpt');

            // random mouse movements
            for (let i = 0; i < 10; i++) {
                const x = Math.floor(Math.random() * (await page.evaluate(() => document.body.scrollWidth)));
                const y = Math.floor(Math.random() * (await page.evaluate(() => document.body.scrollHeight)));
                await page.mouse.move(x, y);
                await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200)); // random delay
            }

            await page.reload({waitUntil: 'networkidle2'});
            await new Promise(resolve => setTimeout(resolve, 2000 * i)); // wait for 2 seconds
            await takeScreenshot(page, `reloaded-chatgpt-${i + 1}`);

            // Check again if login is required
            const newUrl = page.url();
            if (newUrl.includes('/log-in') || newUrl.includes('/login')) {
                console.log('🔐 Still on login page, performing login steps...');
                // continue
            } else {
                console.log('✅ Successfully navigated away from login page');
                isLoginPage = false;
            }
        }
    } else {
        console.log('➡️ Skipping login steps; not on login route');
    }

    // addin input
    await handleInput(page)


    // Press enter
    await page.keyboard.press('Enter');
    await takeScreenshot(page, 'after-press-enter');

    // Wait for response
    await page.waitForSelector('.markdown.prose', {timeout: 60000});

    // wait until comes to composer state
    await page.waitForSelector('[data-testid="composer-speech-button"]', {
        visible: true,
        timeout: 30000, // wait max 30 seconds
    });
    await new Promise(resolve => setTimeout(resolve, 2000)); // wait for 2 seconds
    await takeScreenshot(page, 'response-loaded');

    const response = await page.evaluate(() => {
        const elements = document.querySelectorAll('.markdown.prose');
        return elements[elements.length - 1]?.innerText || '❌ No response found';
    });
    console.log('\n🧠 ChatGPT Response:\n', response);

    // click on sources button
    await getSources(page)

    await extractSources(page)
    await browser.close();
}

runAutomation().catch(console.error);