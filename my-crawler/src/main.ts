// For more information, see https://crawlee.dev/
import { PlaywrightCrawler, Dataset, Log } from 'crawlee';
import { Page } from "playwright";

import type { Cookie } from '@crawlee/types';
import { readdirSync, readFileSync, renameSync, writeFile } from 'fs';
import { exit } from 'process';
import { spawn } from 'child_process';
import { AUDIO_URLS } from './data';

readdirSync("./audio").forEach(filename => {
    let sanitizedFilename;
    const tokens = filename.split("-")
    // x1
    if (tokens.length === 2) {
        sanitizedFilename = tokens[1]
    }
    // x3
    else {
        sanitizedFilename = tokens.slice(tokens.length / 2).join("-")
    }
    renameSync(`./audio/${filename}`, `./audio/${sanitizedFilename}`)
    // console.log(sanitizedFilename)
})

exit(0)

interface Section {
    url: string;
    name: string;
}

// AUDIO_URLS
// const data = JSON.parse(readFileSync('./audio_urls.json').toString()) as Section[];

// await new Promise((resolve => {
//     const ls = spawn( 'youtube-dl', data.map(d=> d.url) );

//     ls.stdout.on( 'data', ( data ) => {
//         console.log( `stdout: ${ data }` );
//     } );

//     ls.stderr.on( 'data', ( data ) => {
//         console.log( `stderr: ${ data }` );
//     } );

//     ls.on( 'close', ( code ) => {
//         console.log( `child process exited with code ${ code }` );
//         resolve(code);
//     } );

// }))

// exit(0);

// login https://amessageforinnergame.com/my-account/
const USERNAME = "scottish.chocola@gmail.com" // #username
const PASSWORD = "gojkef-2tyhwu-xyJmuq" // #password
// button[type=submit][name=login]
// course list div#ld-main-course-list
const WARM_GUY_COURSE = "https://amessageforinnergame.com/courses/%e6%9a%96%e7%94%b7%e7%9a%84%e5%86%ac%e5%a4%a9-%e8%aa%b2%e7%a8%8b%e9%9b%86%e5%90%88/"
const STRAIGHT_GUY_COURSE = "https://amessageforinnergame.com/courses/%e7%9b%b4%e7%94%b7%e7%9a%84%e5%86%ac%e5%a4%a9/"
const sectionData: Section[] = [];

const getListFromCoursePage = async (page: Page, log: Log) => {
    const dataset = await Dataset.getData();
    log.info(`data items: ${dataset.count}`)
    if (dataset.count) {
        log.info(`Already stored sections of ${dataset.count}`);
        return
    }

    const sectionsLocator = await page.locator("a.ld-item-name")
    const sections = await sectionsLocator.all();
    log.info(`Total ${sections.length} sections`)
    for (const section of sections) {
        const sectionUrl = await section.getAttribute("href")
        const sectionName = (await section.textContent())?.trim();
        log.info(`Link: ${sectionName} | ${sectionUrl}`)

        if (!sectionUrl || !sectionName) {
            log.error(`Missing value ${sectionName}, ${sectionUrl}`)
            break;
        }
        sectionData.push({
            url: sectionUrl,
            name: sectionName
        })
    }

    await Dataset.pushData(sectionData.reduce((acc, cur) => {
        return {
            ...acc,
            [cur.name]: cur.url,
        }
    }, {}));

    return sectionData;
}

let cookies: Cookie[] = [];

// PlaywrightCrawler crawls the web using a headless
// browser controlled by the Playwright library.
let crawler = new PlaywrightCrawler({
    // Use the requestHandler to process each of the crawled pages.
    async requestHandler({
        // request, enqueueLinks,
        log,
        page,
        session,
        browserController
    }) {
        await page.locator("#username").fill(USERNAME)
        await page.locator("#password").fill(PASSWORD)
        await page.locator("button[type=submit][name=login]").click()

        await page.goto(STRAIGHT_GUY_COURSE)
        await getListFromCoursePage(page, log);

        // const title = await page.title();
        // log.info(`Title of ${request.loadedUrl} is '${title}'`);

        // Save results as JSON to ./storage/datasets/default
        // await Dataset.pushData({ title, url: request.loadedUrl });

        // Extract links from the current page
        // and add them to the crawling queue.
        // await enqueueLinks();

        session?.getState()
        cookies = await browserController.getCookies(page)

    },
    async failedRequestHandler({ request, log }) {
        log.error("Failed too many times")
    },
    // Uncomment this option to see the browser window.
    headless: false,
    autoscaledPoolOptions: {

    },
    useSessionPool: true,
    persistCookiesPerSession: true,
});

// Add first URL to the queue and start the crawl.
await crawler.run(['https://amessageforinnergame.com/my-account/']);

const audioUrl: Section[] = [];
crawler = new PlaywrightCrawler({
    async requestHandler({
        // request, enqueueLinks,
        log,
        page,
    }) {
        const mp3Url = await page.locator("audio").getAttribute("src")
        if (!mp3Url) {
            log.error(`Failed to get mp3Url at ${await page.title()}, ${page.url()}`)
            return;
        }
        audioUrl.push({
            url: mp3Url,
            name: await page.title()
        })
    },
    headless: false,
    useSessionPool: true,
    persistCookiesPerSession: true,
    preNavigationHooks: [
        async (crawlingContext, gotoOptions) => {
            const { browserController, page } = crawlingContext;
            browserController.setCookies(page, cookies)
        },
    ]
});
await crawler.run(sectionData.map(data => data.url))

// // console.log(audioUrl)

writeFile('audio_urls.json', JSON.stringify(audioUrl), {
    encoding: "utf8"
}, () => {

});