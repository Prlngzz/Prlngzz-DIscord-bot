const {
    Client,
    GatewayIntentBits,
    PermissionsBitField,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType
} = require("discord.js");

const fs = require("fs");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

/* ========================= DATA ========================= */

const DATA_FILE = "./fleasion-data.json";

let data = {
    warnings: {},
    welcomeChannels: {},
    ticketCategories: {},
    raidMode: {}
};

if (fs.existsSync(DATA_FILE)) {
    try {
        const saved = JSON.parse(
            fs.readFileSync(DATA_FILE, "utf8")
        );

        data = {
            warnings: saved.warnings || {},
            welcomeChannels: saved.welcomeChannels || {},
            ticketCategories: saved.ticketCategories || {},
            raidMode: saved.raidMode || {}
        };
    } catch (error) {
        console.log("Could not load fleasion-data.json:", error);
    }
}

function saveData() {
    try {
        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify(data, null, 2)
        );
    } catch (error) {
        console.log("Could not save data:", error);
    }
}

/* ========================= GIVEAWAYS ========================= */

const giveaways = new Map();

/* ========================= ANTISPAM ========================= */

const spamMap = new Map();

/* ========================= ANTIRAID ========================= */

const joinMap = new Map();

/* ========================= HELPERS ========================= */

function parseDuration(input) {
    if (!input) return null;

    const match = input
        .toLowerCase()
        .match(/^(\d+)(s|m|h|d)$/);

    if (!match) return null;

    const amount = Number(match[1]);
    const unit = match[2];

    if (!Number.isFinite(amount) || amount <= 0) {
        return null;
    }

    const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000
    };

    return amount * multipliers[unit];
}

function getMember(message, value) {
    if (!value) return null;

    if (message.mentions.members.size > 0) {
        return message.mentions.members.first();
    }

    return message.guild.members.cache.get(value);
}

function hasPermission(message, permission) {
    return message.member.permissions.has(permission);
}

async function deleteCommand(message) {
    await message.delete().catch(() => {});
}

function ensureGuildWarnings(guildId) {
    if (!data.warnings[guildId]) {
        data.warnings[guildId] = {};
    }
}

/* ========================= READY ========================= */

client.once("ready", () => {
    console.log(
        "PRLNGZZ DOG online as " +
        client.user.tag
    );

    client.user.setActivity("--help");
});

/* ========================= MEMBER JOIN ========================= */

client.on("guildMemberAdd", async (member) => {
    const guildId = member.guild.id;

    /* ---------- WELCOME ---------- */

    const welcomeChannelId =
        data.welcomeChannels[guildId];

    if (welcomeChannelId) {
        const channel =
            member.guild.channels.cache.get(
                welcomeChannelId
            );

        if (channel) {
            channel.send(
                "👋 Welcome " +
                member +
                " to **" +
                member.guild.name +
                "**!"
            ).catch(() => {});
        }
    }

    /* ---------- ANTIRAID ---------- */

    const now = Date.now();

    if (!joinMap.has(guildId)) {
        joinMap.set(guildId, []);
    }

    const joins = joinMap.get(guildId);

    joins.push(now);

    const recentJoins = joins.filter(
        (time) => now - time <= 10000
    );

    joinMap.set(
        guildId,
        recentJoins
    );

    if (recentJoins.length >= 5) {
        data.raidMode[guildId] = true;

        saveData();

        const owner =
            await member.guild.fetchOwner()
                .catch(() => null);

        if (owner) {
            owner.send(
                "🚨 **ANTI-RAID ALERT**\n\n" +
                "5 or more members joined within 10 seconds in **" +
                member.guild.name +
                "**.\n\n" +
                "Raid mode has been enabled."
            ).catch(() => {});
        }

        setTimeout(() => {
            data.raidMode[guildId] = false;
            saveData();
        }, 60000);
    }
});

/* ========================= MESSAGE CREATE ========================= */

client.on("messageCreate", async (message) => {
    if (!message.guild) return;
    if (message.author.bot) return;

    const guildId = message.guild.id;

    /* ========================= ANTISPAM ========================= */

    if (
        !message.member.permissions.has(
            PermissionsBitField.Flags.ManageMessages
        )
    ) {
        const userId = message.author.id;

        if (!spamMap.has(userId)) {
            spamMap.set(userId, []);
        }

        const timestamps = spamMap.get(userId);

        const now = Date.now();

        timestamps.push(now);

        const recent = timestamps.filter(
            (time) => now - time <= 6000
        );

        spamMap.set(
            userId,
            recent
        );

        if (recent.length >= 8) {
            spamMap.delete(userId);

            await message.member.timeout(
                15000,
                "Anti-spam"
            ).catch(() => {});

            message.channel.send(
                "🛑 " +
                message.author +
                " was timed out for spam."
            ).then((msg) => {
                setTimeout(() => {
                    msg.delete().catch(() => {});
                }, 5000);
            }).catch(() => {});

            return;
        }
    }

    /* ========================= AUTOMOD ========================= */

    const inviteRegex =
        /(discord\.gg|discord\.com\/invite)\//i;

    const mentionCount =
        message.mentions.users.size;

    if (
        inviteRegex.test(message.content) ||
        mentionCount >= 6
    ) {
        if (
            !message.member.permissions.has(
                PermissionsBitField.Flags.ManageMessages
            )
        ) {
            await message.delete().catch(() => {});

            message.channel.send(
                "🛡️ " +
                message.author +
                " message removed by automod."
            ).then((msg) => {
                setTimeout(() => {
                    msg.delete().catch(() => {});
                }, 5000);
            }).catch(() => {});

            return;
        }
    }

    /* ========================= COMMAND CHECK ========================= */

    if (!message.content.startsWith("--")) {
        return;
    }

    const raw = message.content.slice(2).trim();

    if (!raw) return;

    const parts = raw.split(/\s+/);

    const cmd = parts.shift().toLowerCase();

    const args = parts;

    /* ========================= HELP ========================= */

    if (cmd === "help") {
        return message.reply(
            "🤖 **PRLNGZZ DOG COMMANDS**\n\n" +

            "**Moderation**\n" +
            "`--ban @user reason`\n" +
            "`--unban userid`\n" +
            "`--kick @user reason`\n" +
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
            "`--nick @user nickname`\n" +
            "`--role @user role`\n\n" +

            "**Information**\n" +
            "`--userinfo @user`\n" +
            "`--serverinfo`\n\n" +

            "**Utility**\n" +
            "`--say message`\n" +
            "`--setup`\n\n" +

            "**Welcome**\n" +
            "`--setwelcome #channel`\n\n" +

            "**Tickets**\n" +
            "`--ticketsetup #category`\n" +
            "`--close`\n\n" +

            "**Giveaways**\n" +
            "`--giveaway 10m 1 Prize`\n\n" +

            "**Examples**\n" +
            "`--giveaway 1h 2 RIVALS Skin`\n" +
            "`--giveaway 1d 1 Skin Case`"
        );
    }

    /* ========================= SETUP ========================= */

    if (cmd === "setup") {
        return message.reply(
            "🛠️ **PRLNGZZ DOG SETUP**\n\n" +

            "**Welcome**\n" +
            "`--setwelcome #channel`\n\n" +

            "**Tickets**\n" +
            "`--ticketsetup #category`\n\n" +

            "**Giveaways**\n" +
            "`--giveaway 10m 1 Prize`\n\n" +

            "**Moderation**\n" +
            "Make sure my role is above the members I need to moderate.\n\n" +

            "**Required Bot Permissions**\n" +
            "• Manage Messages\n" +
            "• Manage Channels\n" +
            "• Manage Roles\n" +
            "• Moderate Members\n" +
            "• Kick Members\n" +
            "• Ban Members\n" +
            "• View Channels\n" +
            "• Send Messages\n"
        );
    }

    /* ========================= WELCOME ========================= */

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

        data.welcomeChannels[guildId] =
            channel.id;

        saveData();

        await deleteCommand(message);

        return channel.send(
            "✅ Welcome channel set!"
        ).catch(() => {});
    }

    /* ========================= WARN ========================= */

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
            getMember(
                message,
                args[0]
            );

        if (!member) {
            return message.reply(
                "❌ Usage: `--warn @user reason`"
            );
        }

        const reason =
            args
                .slice(1)
                .join(" ") ||
            "No reason provided";

        ensureGuildWarnings(guildId);

        if (!data.warnings[guildId][member.id]) {
            data.warnings[guildId][member.id] = [];
        }

        data.warnings[guildId][member.id].push({
            reason: reason,
            moderator: message.author.id,
            time: Date.now()
        });

        saveData();

        await deleteCommand(message);

        return message.channel.send(
            "⚠️ " +
            member +
            " has been warned.\n" +
            "**Reason:** " +
            reason
        );
    }

    /* ========================= WARNINGS ========================= */

    if (cmd === "warnings") {
        const member =
            getMember(
                message,
                args[0]
            ) || message.member;

        ensureGuildWarnings(guildId);

        const warnings =
            data.warnings[guildId][member.id] ||
            [];

        if (warnings.length === 0) {
            return message.reply(
                "✅ " +
                member +
                " has no warnings."
            );
        }

        const text =
            warnings
                .map(
                    (warning, index) =>
                        "**" +
                        (index + 1) +
                        ".** " +
                        warning.reason
                )
                .join("\n");

        return message.reply(
            "⚠️ **Warnings for " +
            member.user.tag +
            "**\n\n" +
            text
        );
    }

    /* ========================= CLEAR WARNINGS ========================= */

    if (cmd === "clearwarnings") {
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
            getMember(
                message,
                args[0]
            );

        if (!member) {
            return message.reply(
                "❌ Usage: `--clearwarnings @user`"
            );
        }

        ensureGuildWarnings(guildId);

        data.warnings[guildId][member.id] = [];

        saveData();

        return message.reply(
            "✅ Cleared all warnings for " +
            member +
            "."
        );
    }

    /* ========================= BAN ========================= */

    if (cmd === "ban") {
        if (
            !hasPermission(
                message,
                PermissionsBitField.Flags.BanMembers
            )
        ) {
            return message.reply(
                "❌ You need **Ban Members**."
            );
        }

        const member =
            getMember(
                message,
                args[0]
            );

        if (!member) {
            return message.reply(
                "❌ Usage: `--ban @user reason`"
            );
        }

        const reason =
            args
                .slice(1)
                .join(" ") ||
            "No reason provided";

        await member.ban({
            reason: reason
        }).catch(() => {});

        await deleteCommand(message);

        return message.channel.send(
            "🔨 Banned **" +
            member.user.tag +
            "**.\n**Reason:** " +
            reason
        );
    }

    /* ========================= UNBAN ========================= */

    if (cmd === "unban") {
        if (
            !hasPermission(
                message,
                PermissionsBitField.Flags.BanMembers
            )
        ) {
            return message.reply(
                "❌ You need **Ban Members**."
            );
        }

        const userId = args[0];

        if (!userId) {
            return message.reply(
                "❌ Usage: `--unban userid`"
            );
        }

        await message.guild.members.unban(
            userId
        ).catch(() => {});

        return message.reply(
            "✅ Unban attempted for `" +
            userId +
            "`."
        );
    }

    /* ========================= KICK ========================= */

    if (cmd === "kick") {
        if (
            !hasPermission(
                message,
                PermissionsBitField.Flags.KickMembers
            )
        ) {
            return message.reply(
                "❌ You need **Kick Members**."
            );
        }

        const member =
            getMember(
                message,
                args[0]
            );

        if (!member) {
            return message.reply(
                "❌ Usage: `--kick @user reason`"
            );
        }

        const reason =
            args
                .slice(1)
                .join(" ") ||
            "No reason provided";

        await member.kick(reason)
            .catch(() => {});

        await deleteCommand(message);

        return message.channel.send(
            "👢 Kicked **" +
            member.user.tag +
            "**.\n**Reason:** " +
            reason
        );
    }

    /* ========================= TIMEOUT ========================= */

    if (
        cmd === "timeout" ||
        cmd === "mute"
    ) {
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
            getMember(
                message,
                args[0]
            );

        const duration =
            parseDuration(args[1]);

        if (!member || !duration) {
            return message.reply(
                "❌ Usage: `--timeout @user 10m`"
            );
        }

        const reason =
            args
                .slice(2)
                .join(" ") ||
            "No reason provided";

        await member.timeout(
            duration,
            reason
        ).catch(() => {});

        await deleteCommand(message);

        return message.channel.send(
            "🔇 Timed out " +
            member +
            " for **" +
            args[1] +
            "**."
        );
    }

    /* ========================= UNTIMEOUT ========================= */

    if (cmd === "unmute") {
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
            getMember(
                message,
                args[0]
            );

        if (!member) {
            return message.reply(
                "❌ Usage: `--unmute @user`"
            );
        }

        await member.timeout(
            null,
            "Timeout removed"
        ).catch(() => {});

        return message.reply(
            "🔊 Unmuted " +
            member +
            "."
        );
    }

    /* ========================= CLEAR ========================= */

    if (
        cmd === "clear" ||
        cmd === "purge"
    ) {
        if (
            !hasPermission(
                message,
                PermissionsBitField.Flags.ManageMessages
            )
        ) {
            return message.reply(
                "❌ You need **Manage Messages**."
            );
        }

        const amount =
            Number(args[0]);

        if (
            !Number.isInteger(amount) ||
            amount < 1 ||
            amount > 100
        ) {
            return message.reply(
                "❌ Choose a number between 1 and 100."
            );
        }

        await message.channel.bulkDelete(
            amount,
            true
        ).catch(() => {});

        const response =
            await message.channel.send(
                "🧹 Deleted **" +
                amount +
                "** messages."
            ).catch(() => null);

        if (response) {
            setTimeout(() => {
                response.delete().catch(() => {});
            }, 3000);
        }

        return;
    }

    /* ========================= LOCK ========================= */

    if (cmd === "lock") {
        if (
            !hasPermission(
                message,
                PermissionsBitField.Flags.ManageChannels
            )
        ) {
            return message.reply(
                "❌ You need **Manage Channels**."
            );
        }

        await message.channel.permissionOverwrites.edit(
            message.guild.roles.everyone,
            {
                SendMessages: false
            }
        ).catch(() => {});

        return message.reply(
            "🔒 Channel locked."
        );
    }

    /* ========================= UNLOCK ========================= */

    if (cmd === "unlock") {
        if (
            !hasPermission(
                message,
                PermissionsBitField.Flags.ManageChannels
            )
        ) {
            return message.reply(
                "❌ You need **Manage Channels**."
            );
        }

        await message.channel.permissionOverwrites.edit(
            message.guild.roles.everyone,
            {
                SendMessages: null
            }
        ).catch(() => {});

        return message.reply(
            "🔓 Channel unlocked."
        );
    }

    /* ========================= SLOWMODE ========================= */

    if (cmd === "slowmode") {
        if (
            !hasPermission(
                message,
                PermissionsBitField.Flags.ManageChannels
            )
        ) {
            return message.reply(
                "❌ You need **Manage Channels**."
            );
        }

        const seconds =
            Number(args[0]);

        if (
            !Number.isInteger(seconds) ||
            seconds < 0 ||
            seconds > 21600
        ) {
            return message.reply(
                "❌ Choose a number from 0 to 21600 seconds."
            );
        }

        await message.channel.setRateLimitPerUser(
            seconds
        ).catch(() => {});

        return message.reply(
            "🐌 Slowmode set to **" +
            seconds +
            " seconds**."
        );
    }

    /* ========================= NICK ========================= */

    if (cmd === "nick") {
        if (
            !hasPermission(
                message,
                PermissionsBitField.Flags.ManageNicknames
            )
        ) {
            return message.reply(
                "❌ You need **Manage Nicknames**."
            );
        }

        const member =
            getMember(
                message,
                args[0]
            );

        const nickname =
            args
                .slice(1)
                .join(" ");

        if (!member || !nickname) {
            return message.reply(
                "❌ Usage: `--nick @user nickname`"
            );
        }

        await member.setNickname(
            nickname
        ).catch(() => {});

        return message.reply(
            "✏️ Nickname changed for " +
            member +
            "."
        );
    }

    /* ========================= ROLE ========================= */

    if (cmd === "role") {
        if (
            !hasPermission(
                message,
                PermissionsBitField.Flags.ManageRoles
            )
        ) {
            return message.reply(
                "❌ You need **Manage Roles**."
            );
        }

        const member =
            getMember(
                message,
                args[0]
            );

        const roleName =
            args
                .slice(1)
                .join(" ");

        if (!member || !roleName) {
            return message.reply(
                "❌ Usage: `--role @user customer`"
            );
        }

        const role =
            message.guild.roles.cache.find(
                (r) =>
                    r.name.toLowerCase() ===
                    roleName.toLowerCase()
            );

        if (!role) {
            return message.reply(
                "❌ Role not found."
            );
        }

        await member.roles.add(
            role
        ).catch(() => {});

        return message.reply(
            "✅ Added **" +
            role.name +
            "** to " +
            member +
            "."
        );
    }

    /* ========================= USERINFO ========================= */

    if (cmd === "userinfo") {
        const member =
            getMember(
                message,
                args[0]
            ) || message.member;

        return message.reply(
            "👤 **USER INFO**\n\n" +
            "**User:** " +
            member.user.tag +
            "\n" +
            "**ID:** `" +
            member.id +
            "`\n" +
            "**Joined:** " +
            member.joinedAt.toLocaleString() +
            "\n" +
            "**Created:** " +
            member.user.createdAt.toLocaleString()
        );
    }

    /* ========================= SERVERINFO ========================= */

    if (cmd === "serverinfo") {
        return message.reply(
            "🏠 **SERVER INFO**\n\n" +
            "**Name:** " +
            message.guild.name +
            "\n" +
            "**ID:** `" +
            message.guild.id +
            "`\n" +
            "**Members:** " +
            message.guild.memberCount +
            "\n" +
            "**Channels:** " +
            message.guild.channels.cache.size +
            "\n" +
            "**Roles:** " +
            message.guild.roles.cache.size
        );
    }

    /* ========================= SAY ========================= */

    if (cmd === "say") {
        if (
            !hasPermission(
                message,
                PermissionsBitField.Flags.ManageMessages
            )
        ) {
            return message.reply(
                "❌ You need **Manage Messages**."
            );
        }

        const text =
            message.content
                .slice(
                    message.content.indexOf("--say") + 5
                )
                .trim();

        if (!text) {
            return message.reply(
                "❌ Usage: `--say message`"
            );
        }

        await deleteCommand(message);

        return message.channel.send(
            text
        );
    }

    /* ========================= TICKET SETUP ========================= */

    if (cmd === "ticketsetup") {
        if (
            !hasPermission(
                message,
                PermissionsBitField.Flags.ManageChannels
            )
        ) {
            return message.reply(
                "❌ You need **Manage Channels**."
            );
        }

        const category =
            message.mentions.channels.first();

        if (
            !category ||
            category.type !== ChannelType.GuildCategory
        ) {
            return message.reply(
                "❌ Usage: `--ticketsetup #category`"
            );
        }

        data.ticketCategories[guildId] =
            category.id;

        saveData();

        const row =
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            "create_ticket"
                        )
                        .setLabel(
                            "Create Ticket"
                        )
                        .setEmoji("🎫")
                        .setStyle(
                            ButtonStyle.Primary
                        )
                );

        await deleteCommand(message);

        return message.channel.send({
            content:
                "🎫 **Need help?**\n\n" +
                "Click the button below to create a ticket.",
            components: [row]
        });
    }

    /* ========================= GIVEAWAY ========================= */

    if (cmd === "giveaway") {
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

        const duration =
            parseDuration(args[0]);

        const winners =
            Number(args[1]);

        const prize =
            args.slice(2).join(" ");

        if (
            !duration ||
            !Number.isInteger(winners) ||
            winners < 1 ||
            !prize
        ) {
            return message.reply(
                "❌ Usage: `--giveaway 10m 1 Prize`"
            );
        }

        const maximumDuration =
            30 * 24 * 60 * 60 * 1000;

        if (duration > maximumDuration) {
            return message.reply(
                "❌ Giveaway duration can't be longer than 30 days."
            );
        }

        const channel =
            message.channel;

        await deleteCommand(message);

        const id =
            message.guild.id +
            "-" +
            Date.now();

        const giveawayData = {
            guildId: message.guild.id,
            channelId: channel.id,
            entrants: new Set(),
            winners: winners,
            prize: prize,
            endTime: Date.now() + duration,
            messageId: null
        };

        giveaways.set(
            id,
            giveawayData
        );

        const row =
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            "giveaway_" + id
                        )
                        .setLabel(
                            "Enter Giveaway"
                        )
                        .setEmoji("🎉")
                        .setStyle(
                            ButtonStyle.Success
                        )
                );

        const giveawayMessage =
            await channel.send({
                content:
                    "🎉 **GIVEAWAY**\n\n" +
                    "Prize: **" +
                    prize +
                    "**\n" +
                    "Winners: **" +
                    winners +
                    "**\n" +
                    "Ends: <t:" +
                    Math.floor(
                        giveawayData.endTime / 1000
                    ) +
                    ":R>\n" +
                    "Entries: **0**\n\n" +
                    "Click the button below to enter!",
                components: [row]
            });

        giveawayData.messageId =
            giveawayMessage.id;

        setTimeout(
            async function () {
                const giveaway =
                    giveaways.get(id);

                if (!giveaway) return;

                const giveawayChannel =
                    client.channels.cache.get(
                        giveaway.channelId
                    );

                if (!giveawayChannel) {
                    giveaways.delete(id);
                    return;
                }

                const entrants =
                    Array.from(
                        giveaway.entrants
                    );

                giveaways.delete(id);

                if (entrants.length === 0) {
                    await giveawayMessage
                        .edit({
                            content:
                                "🎉 **GIVEAWAY ENDED**\n\n" +
                                "Prize: **" +
                                giveaway.prize +
                                "**\n\n" +
                                "❌ Nobody entered.",
                            components: []
                        })
                        .catch(() => {});

                    return;
                }

                const selected = [];

                while (
                    selected.length <
                    Math.min(
                        giveaway.winners,
                        entrants.length
                    )
                ) {
                    const random =
                        entrants[
                            Math.floor(
                                Math.random() *
                                entrants.length
                            )
                        ];

                    if (
                        !selected.includes(
                            random
                        )
                    ) {
                        selected.push(
                            random
                        );
                    }
                }

                const winnerText =
                    selected
                        .map(
                            function (userId) {
                                return (
                                    "<@" +
                                    userId +
                                    ">"
                                );
                            }
                        )
                        .join(", ");

                await giveawayMessage
                    .edit({
                        content:
                            "🎉 **GIVEAWAY ENDED**\n\n" +
                            "Prize: **" +
                            giveaway.prize +
                            "**\n\n" +
                            "🏆 Winner(s): " +
                            winnerText,
                        components: []
                    })
                    .catch(() => {});

                await giveawayChannel.send(
                    "🎉 Congratulations " +
                    winnerText +
                    "! You won **" +
                    giveaway.prize +
                    "**!"
                ).catch(() => {});
            },
            duration
        );

        return;
    }
});

/* ========================= INTERACTIONS ========================= */

client.on(
    "interactionCreate",
    async (interaction) => {
        if (!interaction.isButton()) {
            return;
        }

        /* ========================= GIVEAWAY BUTTON ========================= */

        if (
            interaction.customId.startsWith(
                "giveaway_"
            )
        ) {
            const id =
                interaction.customId.substring(
                    9
                );

            const giveaway =
                giveaways.get(id);

            if (!giveaway) {
                return interaction.reply({
                    content:
                        "❌ This giveaway has ended.",
                    ephemeral: true
                });
            }

            if (
                Date.now() >=
                giveaway.endTime
            ) {
                return interaction.reply({
                    content:
                        "❌ This giveaway has ended.",
                    ephemeral: true
                });
            }

            if (
                giveaway.entrants.has(
                    interaction.user.id
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ You're already entered.",
                    ephemeral: true
                });
            }

            giveaway.entrants.add(
                interaction.user.id
            );

            const giveawayMessage =
                await interaction.channel.messages
                    .fetch(
                        giveaway.messageId
                    )
                    .catch(
                        () => null
                    );

            if (giveawayMessage) {
                const newContent =
                    "🎉 **GIVEAWAY**\n\n" +
                    "Prize: **" +
                    giveaway.prize +
                    "**\n" +
                    "Winners: **" +
                    giveaway.winners +
                    "**\n" +
                    "Ends: <t:" +
                    Math.floor(
                        giveaway.endTime / 1000
                    ) +
                    ":R>\n" +
                    "Entries: **" +
                    giveaway.entrants.size +
                    "**\n\n" +
                    "Click the button below to enter!";

                await giveawayMessage
                    .edit({
                        content:
                            newContent
                    })
                    .catch(() => {});
            }

            return interaction.reply({
                content:
                    "✅ You're entered! Good luck 🍀",
                ephemeral: true
            });
        }

        /* ========================= CREATE TICKET ========================= */

        if (
            interaction.customId ===
            "create_ticket"
        ) {
            const guild =
                interaction.guild;

            const categoryId =
                data.ticketCategories[
                    guild.id
                ];

            if (!categoryId) {
                return interaction.reply({
                    content:
                        "❌ Tickets aren't configured yet.",
                    ephemeral: true
                });
            }

            const existing =
                guild.channels.cache.find(
                    (channel) =>
                        channel.name ===
                        "ticket-" +
                        interaction.user.id
                );

            if (existing) {
                return interaction.reply({
                    content:
                        "❌ You already have a ticket: " +
                        existing,
                    ephemeral: true
                });
            }

            const ticket =
                await guild.channels.create({
                    name:
                        "ticket-" +
                        interaction.user.id,
                    type:
                        ChannelType.GuildText,
                    parent:
                        categoryId,
                    permissionOverwrites: [
                        {
                            id:
                                guild.roles.everyone.id,
                            deny: [
                                PermissionsBitField.Flags.ViewChannel
                            ]
                        },
                        {
                            id:
                                interaction.user.id,
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.ReadMessageHistory
                            ]
                        }
                    ]
                }).catch(() => null);

            if (!ticket) {
                return interaction.reply({
                    content:
                        "❌ I couldn't create the ticket.",
                    ephemeral: true
                });
            }

            const row =
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(
                                "close_ticket"
                            )
                            .setLabel(
                                "Close Ticket"
                            )
                            .setEmoji("🔒")
                            .setStyle(
                                ButtonStyle.Danger
                            )
                    );

            await ticket.send({
                content:
                    "🎫 **Ticket created!**\n\n" +
                    interaction.user +
                    ", please explain what you need help with.",
                components: [row]
            });

            return interaction.reply({
                content:
                    "✅ Your ticket has been created: " +
                    ticket,
                ephemeral: true
            });
        }

        /* ========================= CLOSE TICKET ========================= */

        if (
            interaction.customId ===
            "close_ticket"
        ) {
            await interaction.reply(
                "🔒 Closing ticket..."
            );

            setTimeout(() => {
                interaction.channel
                    .delete()
                    .catch(() => {});
            }, 1500);

            return;
        }
    }
);

/* ========================= ERROR HANDLING ========================= */

process.on(
    "unhandledRejection",
    (error) => {
        console.error(
            "Unhandled rejection:",
            error
        );
    }
);

process.on(
    "uncaughtException",
    (error) => {
        console.error(
            "Uncaught exception:",
            error
        );
    }
);

/* ========================= LOGIN ========================= */

client.login(
    process.env.TOKEN
);
