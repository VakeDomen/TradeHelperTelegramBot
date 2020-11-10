import { setupMaster } from 'cluster';
import * as dotenv from 'dotenv';
import Telegram from 'telegraf';
import KrakenClient from 'kraken-api';

let adminContext: any;
let bot: Telegram<any>;
let kraken: KrakenClient;

interface Credentials {
    fname: string;
    lname: string;
}

interface TelegramUser {
    id: number,
    is_bot: boolean,
    first_name: string;
    last_name: string;
    language_code: string;
}

interface Balance {
    error: any;
    result: {
        ZEUR: string;
        XXBT: string;
        XETH: string;
    }
}

interface Prices {
    error: any;
    result: {[ k: string ]: Pair};
}

/*
    a = ask array(<price>, <whole lot volume>, <lot volume>),
    b = bid array(<price>, <whole lot volume>, <lot volume>),
    c = last trade closed array(<price>, <lot volume>),
    v = volume array(<today>, <last 24 hours>),
    p = volume weighted average price array(<today>, <last 24 hours>),
    t = number of trades array(<today>, <last 24 hours>),
    l = low array(<today>, <last 24 hours>),
    h = high array(<today>, <last 24 hours>),
    o = today's opening price
*/
interface Pair {
    a: [string, string, string];
    b: [string, string, string];
    c: [string, string];
    v: [string, string];
    p: [string, string];
    t: [number, number];
    l: [string, string];
    h: [string, string];
    o: string;
}

function start(): void {
    initKraken();
    initBot();
    console.log("Launching bot...");
    bot.launch();
    console.log("Done!");
}

const startCallback = async (ctx) => {
    const user: TelegramUser = ctx.update.message.from;
    if (!isValidUser(user)) {
        ctx.reply("Sorry, you should not be doing this...");
        return;
    }
    if (!adminContext) {
        adminContext = ctx;
        ctx.reply("Hey! I set you up as admin!");
    }  
}

const balanceCallback = async (ctx) => {
    if (!isValidUser(ctx.update.message.from)) {
        ctx.reply("Sorry, you should not be doing this...");
        return;
    }
    let [balance, prices]: [Balance, Prices] = await Promise.all([
        kraken.api('Balance'), 
        getPrices()
    ]);
    let message: string[] = ['BALANCE:'];
    message.push(`EUR: ${balance.result.ZEUR}`);
    message.push(`BTC: ${(Number(balance.result.XXBT) * Number(prices.result.XXBTZEUR.c[0])).toFixed(4)} (${balance.result.XXBT})`);
    message.push(`ETH: ${(Number(balance.result.XETH) * Number(prices.result.XETHZEUR.c[0])).toFixed(4)} (${balance.result.XETH})`);
    ctx.replyWithMarkdown(message.join("\n\t"));
}


const priceCallback = async (ctx) => {
    const prices: Prices = await getPrices(); 
    const table = [
        {
            CURRENCY: 'BTC',
            EUR: `${Number(prices.result.XXBTZEUR.c[0]).toFixed(2)}€`,
            USD: `${Number(prices.result.XXBTZUSD.c[0]).toFixed(2)}$`
        },
        {
            CURRENCY: 'ETH',
            EUR: `${Number(prices.result.XETHZEUR.c[0]).toFixed(2)}€\t\t`,
            USD: `${Number(prices.result.XETHZUSD.c[0]).toFixed(2)}$`
        }
    ]
    let message: string = '';
    message += `\`\`\`\n`
    message += ` CURRENCY |     EUR     |     USD \n`;
    message += `--------- | ----------- | ---------\n`;
    for (const row of table) {
        message += `\t\t\t\t${row.CURRENCY}\t\t\t| ${row.EUR} \t\t| ${row.USD}\n`;
    }
    message += `\`\`\``;
    ctx.replyWithMarkdown(message);
}

function getPrices(): Promise<Prices> {
    return kraken.api('Ticker', { pair : 'XXBTZUSD,XETHZUSD,XXBTZEUR,XETHZEUR' }); 
}

function isValidUser(user: TelegramUser): boolean {
    if (process.env.OWNER_TELEGRAM_ID === `${user.id}`) {
        return true;
    }
    if (adminContext) {
        adminContext.reply(`User ${user.first_name} ${user.last_name} (${user.id}) tryed to use my services!`);
    }
    return false;
}

function checkEnv(): void {
    console.log("Checking credentials...");
    dotenv.config();
    if (!process.env.BOT_TOKEN) {
        console.log("Bot token not specified!");
        process.exit(1);
    }
    if (!process.env.KRAKEN_SECRET) {
        console.log("Kraken secret not specified!");
        process.exit(1);
    }
    if (!process.env.KRAKEN_KEY) {
        console.log("Kraken key not specified!");
        process.exit(1);
    }
    if (!process.env.OWNER_TELEGRAM_ID) {
        console.log("Owner of the account not specified!");
        process.exit(1);
    }
    console.log("Crednetials checked!");
}

function initKraken(): void {
    kraken = new KrakenClient(process.env.KRAKEN_KEY, process.env.KRAKEN_SECRET);
}

function initBot(): void {
    console.log("Setting up bot...")
    bot = new Telegram(process.env.BOT_TOKEN);
    bot.start(startCallback);
    bot.command('price', priceCallback);
    bot.command('balance', balanceCallback);
    console.log("Bot set up!");
}

checkEnv();
start();

