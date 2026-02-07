
import { chromium } from 'playwright';

(async () => {
    try {
        const browser = await chromium.connectOverCDP('http://localhost:9222');
        const context = browser.contexts()[0];
        const page = context.pages()[0];

        if (!page) {
            console.log('App running, but no page found.');
            await browser.close();
            return;
        }

        console.log(`Title: ${await page.title()}`);
        console.log(`URL: ${page.url()}`);
        await page.screenshot({ path: 'current-view.png' });
        console.log('Screenshot saved to current-view.png');

        try {
            const bodyText = await page.evaluate(() => document.body.innerText);
            console.log('--- Body Text ---');
            console.log(bodyText);
            console.log('-----------------');
        } catch (e) {
            console.log('Could not get body text.');
        }

        await browser.close();
    } catch (error) {
        console.error('Inspection failed:', error);
    }
})();
