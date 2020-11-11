import { setupMaster } from 'cluster';
import * as dotenv from 'dotenv';
import Telegram from 'telegraf';
import KrakenClient from 'kraken-api';

let adminContext: any;
let bot: Telegram<any>;
let kraken: KrakenClient;
let historyCahe: [number, PricesSince][]

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

interface PricesSince {
    error: any;
    result: {[ k: string ]: [string, string, number, string, string, string][] };
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

interface TradesHistory {
    error: any;
    result: {
        trades: {[ k: string ]: Trade};
        count: number;
    }
}

interface Trade {
    ordertxid: string;
    postxid: string;
    pair: string;
    time: number;
    type: 'buy' | 'sell';
    ordertype: string;
    price: string;
    cost: string;
    fee: string;
    vol: string;
    margin: string;
    misc: string;
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
        getBalance(), 
        getPrices('XXBTZEUR,XETHZEUR')
    ]);
    let message: string[] = ['\`\`\`'];
    message.push(`EUR: ${balance.result.ZEUR}€`);
    message.push(`BTC: ${(Number(balance.result.XXBT) * Number(prices.result.XXBTZEUR.c[0])).toFixed(4)}€ (${balance.result.XXBT})`);
    message.push(`ETH: ${(Number(balance.result.XETH) * Number(prices.result.XETHZEUR.c[0])).toFixed(4)}€ (${balance.result.XETH})`);
    message.push('\`\`\`');
    ctx.replyWithMarkdown(message.join("\n"));
}


const priceCallback = async (ctx) => {
    const prices: Prices = await getPrices('XXBTZUSD,XETHZUSD,XXBTZEUR,XETHZEUR'); 
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
    const message = constructTable(table, ['CURRENCY', 'EUR', 'USD']);
    ctx.replyWithMarkdown(message);
}

const tradeValueCallback = async (ctx) => {
    if (!isValidUser(ctx.update.message.from)) {
        ctx.reply("Sorry, you should not be doing this...");
        return;
    }
    const coins = ['XETH', 'XXBT'];
    const balance = await getBalance();
    const currentPrices = await getPrices('XXBTZUSD,XETHZUSD');
    const lastTimestamp = await getLastTradeTimestamp();

    if (!lastTimestamp || !balance) {
        ctx.reply('No trades recorded...');
        return;
    }
    for (const currency of coins) {
        const pair = `${currency}ZUSD`;
        if (balance.result[currency] && Number(balance.result[currency]) > 0.000001) {
            const prices = await getUSDPricesAt(pair, lastTimestamp);
            if (!prices) continue;
            historyCahe[pair] = [lastTimestamp, prices];
            const diff = (1 - (Number(prices.result[pair][0][0]) / Number(currentPrices.result[pair].c[0]))) * 100;
            let emoji = '';
            if (diff > 0) {
                emoji = '✅';
            } else {
                emoji = '🔻'
            }
            ctx.reply(`${currency} value diff: ${(diff).toFixed(3)}% ${emoji}`);
        }
    }
}

const lastTradeCallback = async (ctx) => {
    if (!isValidUser(ctx.update.message.from)) {
        ctx.reply("Sorry, you should not be doing this...");
        return;
    }
    const lastTimestamp = await getLastTradeTimestamp();
    if (!lastTimestamp) {
        ctx.reply('No trades recorded...');
    }
    const lastTradeTime = new Date(lastTimestamp * 1000);
    ctx.reply(`Last trade: ${lastTradeTime.toUTCString()}`);
}

function getPrices(pairs: string): Promise<Prices> {
    return kraken.api('Ticker', { pair : pairs }); 
}

function getBalance(): Promise<Balance> {
    return kraken.api('Balance');
}

function getUSDPricesAt(currency: string, timestamp: number): Promise<PricesSince> {
    if (historyCahe[currency] && timestamp === historyCahe[currency][0]) {
        return Promise.resolve(historyCahe[currency][1]);
    } else {
        return kraken.api('Trades', { pair : currency, since: timestamp }); 
    }
}

function constructTable(data: any[], keys: string[]): string {
    let message: string = '';
    message += `\`\`\`\n`
    message += data.map((row: any) => {return keys.map((key: string) => row[key]).join("   |   ");}).join('\n');
    message += `\`\`\``;
    return message;
}

async function getLastTradeTimestamp(): Promise<number> {
    try {
        const data: TradesHistory = await kraken.api('TradesHistory');
        return Math.max(...Object.values(data.result.trades).map((trade: Trade) => trade.time));
    } catch {
        return null;
    }
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
    console.log("Setting up bot...");
    historyCahe = [];
    bot = new Telegram(process.env.BOT_TOKEN);
    bot.start(startCallback);
    bot.command('price', priceCallback);
    bot.command('balance', balanceCallback);
    bot.command('stonks', tradeValueCallback);
    bot.command('last', lastTradeCallback);
    console.log("Bot set up!");
}

checkEnv();
start();

