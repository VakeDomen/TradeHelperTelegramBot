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
        kraken.api('Balance'),
        getPrices()
    ]);
    let message = ['BALANCE:'];
    message.push(`EUR: ${balance.result.ZEUR}`);
    message.push(`BTC: ${(Number(balance.result.XXBT) * Number(prices.result.XXBTZEUR.c[0])).toFixed(4)} (${balance.result.XXBT})`);
    message.push(`ETH: ${(Number(balance.result.XETH) * Number(prices.result.XETHZEUR.c[0])).toFixed(4)} (${balance.result.XETH})`);
    ctx.replyWithMarkdown(message.join("\n\t"));
});
const priceCallback = (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    const prices = yield getPrices();
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
    let message = '';
    message += `\`\`\`\n`;
    message += ` CURRENCY |     EUR     |     USD \n`;
    message += `--------- | ----------- | ---------\n`;
    for (const row of table) {
        message += `\t\t\t\t${row.CURRENCY}\t\t\t| ${row.EUR} \t\t| ${row.USD}\n`;
    }
    message += `\`\`\``;
    ctx.replyWithMarkdown(message);
});
function getPrices() {
    return kraken.api('Ticker', { pair: 'XXBTZUSD,XETHZUSD,XXBTZEUR,XETHZEUR' });
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
    bot = new telegraf_1.default(process.env.BOT_TOKEN);
    bot.start(startCallback);
    bot.command('price', priceCallback);
    bot.command('balance', balanceCallback);
    console.log("Bot set up!");
}
checkEnv();
start();
//# sourceMappingURL=bot.js.map