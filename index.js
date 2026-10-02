```js
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

let data = {
    warnings: {},
    welcomeChannels: {},
    ticketCategories: {},
    raidMode: {}
};

if (fs.existsSync(DATA_FILE)) {
    try {
        data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    } catch (error) {
        console.log("Could not load data file.");
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

async function deleteCommand(message) {
    await message.delete().catch(function () {});
}

function hasPermission(message, permission) {
    return message.member.permissions.has(permission);
}

function getMembers(message) {
    return Array.from(message.mentions.members.values());
}

function getMember(message, value) {
    if (!value) return null;

    const mentioned = message.mentions.members.first();

    if (mentioned) {
        return mentioned;
    }

    return message.guild.members.cache.get(value) || null;
}

function parseDuration(value) {
    if (!value) return null;

    const match = value.match(/^(\d+)(s|m|h|d)$/i);

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

const spamTracker = new Map();
const raidTracker = new Map();
const giveaways = new Map();

client.once("ready", function () {
    console.log(
        "PRLNGZZ DOG online as " + client.user.tag
    );

    client.user.setActivity("--help");
});

/* ========================= MEMBER JOIN ========================= */

client.on("guildMemberAdd", async function (member) {
    const guildId = member.guild.id;

    if (!raidTracker.has(guildId)) {
        raidTracker.set(guildId, []);
    }

    const joins = raidTracker.get(guildId);

    joins.push(Date.now());

    const recent = joins.filter(function (time) {
        return Date.now() - time <= 10000;
    });

    raidTracker.set(guildId, recent);

    if (recent.length >= 5 && !data.raidMode[guildId]) {
        data.raidMode[guildId] = true;

        saveData();

        try {
            const owner =
                await member.guild.fetchOwner();

            await owner.send(
                "🚨 RAID ALERT\n\n" +
                "5 or more members joined within 10 seconds in " +
                member.guild.name +
                ".\n\n" +
                "Raid mode activated for 60 seconds."
            );
        } catch (error) {
            console.log(
                "Could not DM server owner."
            );
        }

        setTimeout(function () {
            data.raidMode[guildId] = false;
            saveData();
        }, 60000);
    }

    const welcomeChannelId =
        data.welcomeChannels[guildId];

    if (!welcomeChannelId) return;

    const channel =
        member.guild.channels.cache.get(
            welcomeChannelId
        );

    if (!channel) return;

    channel.send(
        "👋 Welcome " +
        member.user.toString() +
        " to **" +
        member.guild.name +
        "**!"
    ).catch(function () {});
});

/* ========================= MESSAGES ========================= */

client.on("messageCreate", async function (message) {
    if (!message.guild) return;
    if (message.author.bot) return;

    const content = message.content.trim();

    /* ========================= ANTI-SPAM ========================= */

    if (
        !message.member.permissions.has(
            PermissionsBitField.Flags.ManageMessages
        ) &&
        !content.startsWith(PREFIX)
    ) {
        const userId = message.author.id;

        if (!spamTracker.has(userId)) {
            spamTracker.set(userId, []);
        }

        const messages = spamTracker.get(userId);

        messages.push(Date.now());

        const recent = messages.filter(
            function (time) {
                return Date.now() - time <= 6000;
            }
        );

        spamTracker.set(userId, recent);

        if (recent.length >= 8) {
            spamTracker.delete(userId);

            try {
                await message.member.timeout(
                    15000,
                    "Anti-spam"
                );

                await message.channel.send(
                    "🛑 " +
                    message.author.toString() +
                    " has been timed out for **15 seconds** for spamming."
                );
            } catch (error) {
                console.log(
                    "Could not timeout spammer."
                );
            }
        }
    }

    /* ========================= AUTOMOD ========================= */

    if (
        !content.startsWith(PREFIX) &&
        !message.member.permissions.has(
            PermissionsBitField.Flags.ManageMessages
        )
    ) {
        const inviteRegex =
            /(discord\.gg\/|discord\.com\/invite\/)/i;

        if (inviteRegex.test(content)) {
            try {
                await message.delete();

                await message.channel.send(
                    "🚫 " +
                    message.author.toString() +
                    ", Discord invites are not allowed here."
                );
            } catch (error) {}

            return;
        }

        if (message.mentions.users.size >= 6) {
            try {
                await message.delete();

                await message.channel.send(
                    "🚫 " +
                    message.author.toString() +
                    ", too many mentions."
                );
            } catch (error) {}

            return;
        }
    }

    if (!content.startsWith(PREFIX)) return;

    const args = content
        .slice(PREFIX.leng
```
