"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
const telegraf_1 = __importDefault(require("telegraf"));
const kraken_api_1 = __importDefault(require("kraken-api"));
let adminContext;
let bot;
let kraken;
let historyCahe;
function start() {
    initKraken();
    initBot();
    console.log("Launching bot...");
    bot.launch();
    console.log("Done!");
}
const startCallback = (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    const user = ctx.update.message.from;
    if (!isValidUser(user)) {
        ctx.reply("Sorry, you should not be doing this...");
        return;
    }
    if (!adminContext) {
        adminContext = ctx;
        ctx.reply("Hey! I set you up as admin!");
    }
});
const balanceCallback = (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (!isValidUser(ctx.update.message.from)) {
        ctx.reply("Sorry, you should not be doing this...");
        return;
    }
    let [balance, prices] = yield Promise.all([
        getBalance(),
        getPrices('XXBTZEUR,XETHZEUR')
    ]);
    let message = ['\`\`\`'];
    message.push(`EUR: ${balance.result.ZEUR}€`);
    message.push(`BTC: ${(Number(balance.result.XXBT) * Number(prices.result.XXBTZEUR.c[0])).toFixed(4)}€ (${balance.result.XXBT})`);
    message.push(`ETH: ${(Number(balance.result.XETH) * Number(prices.result.XETHZEUR.c[0])).toFixed(4)}€ (${balance.result.XETH})`);
    message.push('\`\`\`');
    ctx.replyWithMarkdown(message.join("\n"));
});
const priceCallback = (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    const prices = yield getPrices('XXBTZUSD,XETHZUSD,XXBTZEUR,XETHZEUR');
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
    ];
    const message = constructTable(table, ['CURRENCY', 'EUR', 'USD']);
    ctx.replyWithMarkdown(message);
});
const tradeValueCallback = (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (!isValidUser(ctx.update.message.from)) {
        ctx.reply("Sorry, you should not be doing this...");
        return;
    }
    const coins = ['XETH', 'XXBT'];
    const balance = yield getBalance();
    const currentPrices = yield getPrices('XXBTZUSD,XETHZUSD');
    const lastTimestamp = yield getLastTradeTimestamp();
    if (!lastTimestamp || !balance) {
        ctx.reply('No trades recorded...');
        return;
    }
    for (const currency of coins) {
        const pair = `${currency}ZUSD`;
        if (balance.result[currency] && Number(balance.result[currency]) > 0.00000001) {
            const prices = yield getUSDPricesAt(pair, lastTimestamp);
            if (!prices)
                continue;
            historyCahe[pair] = [lastTimestamp, prices];
            const diff = (1 - (Number(prices.result[pair][0][0]) / Number(currentPrices.result[pair].c[0]))) * 100;
            let emoji = '';
            if (diff > 0) {
                emoji = '✅';
            }
            else {
                emoji = '🔻';
            }
            ctx.reply(`${currency} value diff: ${(diff).toFixed(3)} ${emoji}`);
        }
    }
});
const lastTradeCallback = (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    const lastTimestamp = yield getLastTradeTimestamp();
    if (!lastTimestamp) {
        ctx.reply('No trades recorded...');
    }
    const lastTradeTime = new Date(lastTimestamp * 1000);
    ctx.reply(`Last trade: ${lastTradeTime.toUTCString()}`);
});
function getPrices(pairs) {
    return kraken.api('Ticker', { pair: pairs });
}
function getBalance() {
    return kraken.api('Balance');
}
function getUSDPricesAt(currency, timestamp) {
    if (historyCahe[currency] && timestamp === historyCahe[currency][0]) {
        return Promise.resolve(historyCahe[currency][1]);
    }
    else {
        return kraken.api('Trades', { pair: currency, since: timestamp });
    }
}
function constructTable(data, keys) {
    let message = '';
    message += `\`\`\`\n`;
    message += data.map((row) => { return keys.map((key) => row[key]).join("   |   "); }).join('\n');
    message += `\`\`\``;
    return message;
}
function getLastTradeTimestamp() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const data = yield kraken.api('TradesHistory');
            return Math.max(...Object.values(data.result.trades).map((trade) => trade.time));
        }
        catch (_a) {
            return null;
        }
    });
}
function isValidUser(user) {
    if (process.env.OWNER_TELEGRAM_ID === `${user.id}`) {
        return true;
    }
    if (adminContext) {
        adminContext.reply(`User ${user.first_name} ${user.last_name} (${user.id}) tryed to use my services!`);
    }
    return false;
}
function checkEnv() {
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
function initKraken() {
    kraken = new kraken_api_1.default(process.env.KRAKEN_KEY, process.env.KRAKEN_SECRET);
}
function initBot() {
    console.log("Setting up bot...");
    historyCahe = [];
    bot = new telegraf_1.default(process.env.BOT_TOKEN);
    bot.start(startCallback);
    bot.command('price', priceCallback);
    bot.command('balance', balanceCallback);
    bot.command('stonks', tradeValueCallback);
    bot.command('last', lastTradeCallback);
    console.log("Bot set up!");
}
checkEnv();
start();
//# sourceMappingURL=bot.js.map