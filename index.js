const {
    Client,
    GatewayIntentBits,
    PermissionsBitField,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const fs = require("fs");

const PREFIX = "--";
const DATA_FILE = "./fleasion-data.json";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

/* =========================
   DATA
========================= */

const defaultData = {
    warnings: {},
    welcomeChannels: {},
    ticketCategories: {},
    raidMode: {},
    giveaways: {}
};

let data = defaultData;

if (fs.existsSync(DATA_FILE)) {
    try {
        const savedData = JSON.parse(
            fs.readFileSync(DATA_FILE, "utf8")
        );

        data = {
            ...defaultData,
            ...savedData,

            warnings: savedData.warnings || {},
            welcomeChannels: savedData.welcomeChannels || {},
            ticketCategories: savedData.ticketCategories || {},
            raidMode: savedData.raidMode || {},
            giveaways: savedData.giveaways || {}
        };
    } catch (error) {
        console.log("Could not load data file. Using default data.");
        data = defaultData;
    }
}

function saveData() {
    try {
        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify(data, null, 2)
        );
    } catch (error) {
        console.log("Could not save data.");
    }
}

/* =========================
   GIVEAWAYS
========================= */

const giveaways = new Map();

function saveGiveaways() {
    data.giveaways = {};

    for (const [id, giveaway] of giveaways.entries()) {
        data.giveaways[id] = {
            channelId: giveaway.channelId,
            messageId: giveaway.messageId,
            entrants: Array.from(giveaway.entrants),
            winners: giveaway.winners,
            prize: giveaway.prize,
            endTime: giveaway.endTime
        };
    }

    saveData();
}

function loadGiveaways() {
    if (!data.giveaways) {
        data.giveaways = {};
    }

    for (const [id, giveaway] of Object.entries(data.giveaways)) {
        giveaways.set(id, {
            channelId: giveaway.channelId,
            messageId: giveaway.messageId,
            entrants: new Set(giveaway.entrants || []),
            winners: giveaway.winners,
            prize: giveaway.prize,
            endTime: giveaway.endTime
        });
    }
}

async function endGiveaway(id) {
    const giveaway = giveaways.get(id);

    if (!giveaway) return;

    try {
        const channel = await client.channels.fetch(
            giveaway.channelId
        );

        if (!channel) {
            giveaways.delete(id);
            saveGiveaways();
            return;
        }

        const giveawayMessage =
            await channel.messages.fetch(
                giveaway.messageId
            ).catch(function () {
                return null;
            });

        const entrants = Array.from(
            giveaway.entrants
        );

        let winners = [];

        if (entrants.length > 0) {
            const shuffled = [...entrants];

            for (let i = shuffled.length - 1; i > 0; i--) {
                const random =
                    Math.floor(Math.random() * (i + 1));

                [shuffled[i], shuffled[random]] =
                    [shuffled[random], shuffled[i]];
            }

            winners = shuffled.slice(
                0,
                Math.min(
                    giveaway.winners,
                    shuffled.length
                )
            );
        }

        const winnerText =
            winners.length > 0
                ? winners.map(function (userId) {
                    return "<@" + userId + ">";
                }).join(", ")
                : "Nobody entered.";

        if (giveawayMessage) {
            await giveawayMessage.edit({
                content:
                    "🎉 **GIVEAWAY ENDED** 🎉\n\n" +
                    "Prize: **" +
                    giveaway.prize +
                    "**\n" +
                    "Winners: " +
                    winnerText +
                    "\n\n" +
                    "Entries: **" +
                    entrants.length +
                    "**"
            }).catch(function () {});
        }

        await channel.send(
            "🎉 Giveaway ended!\n\n" +
            "Prize: **" +
            giveaway.prize +
            "**\n" +
            "Winner(s): " +
            winnerText
        ).catch(function () {});

    } catch (error) {
        console.log(
            "Could not finish giveaway:",
            error.message
        );
    }

    giveaways.delete(id);
    saveGiveaways();
}

function scheduleGiveaway(id) {
    const giveaway = giveaways.get(id);

    if (!giveaway) return;

    const remaining =
        giveaway.endTime - Date.now();

    if (remaining <= 0) {
        endGiveaway(id);
        return;
    }

    setTimeout(function () {
        endGiveaway(id);
    }, remaining);
}

loadGiveaways();

for (const id of giveaways.keys()) {
    scheduleGiveaway(id);
}

/* =========================
   OTHER BOT STUFF
========================= */

function hasPermission(message, permission) {
    return message.member.permissions.has(permission);
}

function getMembers(message) {
    return Array.from(
        message.mentions.members.values()
    );
}

function getMember(message, value) {
    if (!value) return null;

    const mentioned =
        message.mentions.members.first();

    if (mentioned) {
        return mentioned;
    }

    return message.guild.members.cache.get(
        value
    ) || null;
}

function parseDuration(value) {
    if (!value) return null;

    const match =
        value.match(/^(\d+)(s|m|h|d)$/i);

    if (!match) return null;

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    if (unit === "s") return amount * 1000;
    if (unit === "m") return amount * 60 * 1000;
    if (unit === "h") return amount * 60 * 60 * 1000;
    if (unit === "d") return amount * 24 * 60 * 60 * 1000;

    return null;
}

function durationText(ms) {
    const seconds = Math.floor(ms / 1000);

    if (seconds < 60) {
        return String(seconds) + "s";
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
        return String(minutes) + "m";
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
        return String(hours) + "h";
    }

    return String(Math.floor(hours / 24)) + "d";
}
