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

        data.warnings = data.warnings || {};
        data.welcomeChannels = data.welcomeChannels || {};
        data.ticketCategories = data.ticketCategories || {};
        data.raidMode = data.raidMode || {};
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

function hasPermission(message, permission) {
    return message.member.permissions.has(permission);
}

function getMember(message, value) {
    if (!value) return null;

    const mentioned = message.mentions.members.first();

    if (mentioned) return mentioned;

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


/* =========================
   MEMBER JOIN / ANTI RAID
========================= */

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

    if (
        recent.length >= 5 &&
        !data.raidMode[guildId]
    ) {
        data.raidMode[guildId] = true;

        saveData();

        try {
            const owner = await member.guild.fetchOwner();

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


/* =========================
   MESSAGE HANDLER
========================= */

client.on(
    "messageCreate",
    async function (message) {

        if (!message.guild) return;
        if (message.author.bot) return;

        const content = message.content.trim();


        /* =========================
           ANTI SPAM
        ========================= */

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

            const messages =
                spamTracker.get(userId);

            messages.push(Date.now());

            const recent =
                messages.filter(function (time) {
                    return Date.now() - time <= 6000;
                });

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


        /* =========================
           AUTOMOD
        ========================= */

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


        /* =========================
           COMMAND PARSING
        ========================= */

        const args =
            content
                .slice(PREFIX.length)
                .trim()
                .split(/\s+/);

        const command = args.shift();

        if (!command) return;

        const cmd = command.toLowerCase();


        /* =========================
           SETUP
        ========================= */

        if (cmd === "setup") {

            return message.reply(
                "🐕 **PRLNGZZ DOG SETUP**\n\n" +

                "━━━━━━━━━━━━━━━━━━━━\n\n" +

                "👋 **WELCOME**\n" +
                "`--setwelcome #channel`\n" +
                "Sets the welcome channel.\n\n" +

                "━━━━━━━━━━━━━━━━━━━━\n\n" +

                "🎫 **TICKETS**\n" +
                "`--ticketsetup #category`\n" +
                "Creates the ticket system.\n\n" +

                "━━━━━━━━━━━━━━━━━━━━\n\n" +

                "🎉 **GIVEAWAYS**\n" +
                "`--giveaway 10m 1 500 Robux`\n" +
                "`--giveaway 1h 2 RIVALS Skin`\n" +
                "`--giveaway 1d 1 Skin Case`\n\n" +

                "━━━━━━━━━━━━━━━━━━━━\n\n" +

                "🛡️ **PROTECTION**\n" +
                "Automod: ON\n" +
                "Anti-spam: 8 messages / 6 seconds -> 15s timeout\n" +
                "Anti-raid: 5 joins / 10 seconds -> owner alert\n\n" +

                "━━━━━━━━━━━━━━━━━━━━\n\n" +

                "🔨 **MODERATION**\n" +
                "`--ban @user`\n" +
                "`--unban USER_ID`\n" +
                "`--kick @user`\n" +
                "`--mute @user 10m`\n" +
                "`--unmute @user`\n" +
                "`--timeout @user 10m`\n" +
                "`--warn @user reason`\n" +
                "`--warnings @user`\n" +
                "`--clearwarnings @user`\n" +
                "`--clear 10`\n" +
                "`--purge 10`\n" +
                "`--lock`\n" +
                "`--unlock`\n" +
                "`--slowmode 5`\n" +
                "`--nick @user NewName`\n" +
                "`--role @user customer`\n\n" +

                "━━━━━━━━━━━━━━━━━━━━\n\n" +

                "📊 **INFO**\n" +
                "`--userinfo @user`\n" +
                "`--serverinfo`\n" +
                "`--say message`\n\n" +

                "━━━━━━━━━━━━━━━━━━━━\n\n" +

                "❓ **HELP**\n" +
                "`--help`\n" +
                "`--setup`\n\n" +

                "🐕 **PRLNGZZ DOG**"
            );
        }


        /* =========================
           HELP
        ========================= */

        if (cmd === "help") {

            return message.reply(
                "🐕 **PRLNGZZ DOG**\n\n" +

                "**Moderation**\n" +
                "`--ban @user`\n" +
                "`--unban USER_ID`\n" +
                "`--kick @user`\n" +
                "`--mute @user 10m`\n" +
                "`--unmute @user`\n" +
                "`--timeout @user 10m`\n" +
                "`--warn @user reason`\n" +
                "`--warnings @user`\n" +
                "`--clearwarnings @user`\n" +
                "`--clear 10`\n" +
                "`--purge 10`\n" +
                "`--lock`\n" +
                "`--unlock`\n" +
                "`--slowmode 5`\n" +
                "`--nick @user Name`\n" +
                "`--role @user customer`\n\n" +

                "**Server**\n" +
                "`--setwelcome #channel`\n" +
                "`--ticketsetup #category`\n" +
                "`--giveaway 10m 1 Prize`\n\n" +

                "**Info**\n" +
                "`--userinfo @user`\n" +
                "`--serverinfo`\n" +
                "`--say message`\n\n" +

                "**Setup**\n" +
                "`--setup`"
            );
        }


        /* =========================
           SET WELCOME
        ========================= */

        if (cmd === "setwelcome") {

            if (
                !hasPermission(
                    message,
                    PermissionsBitField.Flags.ManageGuild
                )
            ) {
                return message.reply(
                    "❌ You need **Manage Server**."
                );
            }

            const channel =
                message.mentions.channels.first();

            if (!channel) {
                return message.reply(
                    "❌ Usage: `--setwelcome #channel`"
                );
            }

            data.welcomeChannels[
                message.guild.id
            ] = channel.id;

            saveData();

            return message.reply(
                "✅ Welcome channel set to " +
                channel.toString()
            );
        }


        /* =========================
           WARN
        ========================= */

        if (cmd === "warn") {

            if (
                !hasPermission(
                    message,
                    PermissionsBitField.Flags.ModerateMembers
                )
            ) {
                return message.reply(
                    "❌ You need **Moderate Members**."
                );
            }

            const member =
                getMember(message, args[0]);

            if (!member) {
                return message.reply(
                    "❌ Usage: `--warn @user reason`"
                );
            }

            const reason =
                args.slice(1).join(" ") ||
                "No reason provided";

            const guildId =
                message.guild.id;

            if (!data.warnings[guildId]) {
                data.warnings[guildId] = {};
            }

            if (!data.warnings[guildId][member.id]) {
                data.warnings[guildId][member.id] = [];
            }

            data.warnings[guildId][member.id].push({
                reason: reason,
                moderator: message.author.id,
                timestamp: Date.now()
            });

            saveData();

            return message.reply(
                "⚠️ " +
                member.toString() +
                " has been warned.\n" +
                "Reason: **" +
                reason +
                "**\n" +
                "Warnings: **" +
                data.warnings[guildId][member.id].length +
                "**"
            );
        }


        /* =========================
           WARNINGS
        ========================= */

        if (cmd === "warnings") {

            const member =
                getMember(message, args[0]);

            if (!member) {
                return message.reply(
                    "❌ Usage: `--warnings @user`"
                );
            }

            const guildWarnings =
                data.warnings[message.guild.id] || {};

            const warnings =
                guildWarnings[member.id] || [];

            if (warnings.length === 0) {
                return message.reply(
                    "✅ " +
                    member.toString() +
                    " has no warnings."
                );
            }

            let text =
                "⚠️ **Warnings for " +
                member.user.tag +
                "**\n\n";

            warnings.forEach(
                function (warning, index) {

                    text +=
                        "**" +
                        (index + 1) +
                        ".** " +
                        warning.reason +
                        "\n";
                }
            );

            return
```
