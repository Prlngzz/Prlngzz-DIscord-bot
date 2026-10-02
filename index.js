const {
    Client,
    GatewayIntentBits,
    PermissionsBitField
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

const PREFIX = "--";
const DATA_FILE = "./fleasion-data.json";

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
        console.log("Could not load data file:", error);
    }
}

function saveData() {
    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(data, null, 2)
    );
}

function hasPermission(message, permission) {
    return message.member &&
        message.member.permissions.has(permission);
}

async function deleteCommand(message) {
    try {
        await message.delete();
    } catch (error) {
        console.log("Could not delete command:", error.message);
    }
}

function getUserKey(guildId, userId) {
    return guildId + "_" + userId;
}

function parseDuration(input) {
    if (!input) return null;

    const match = input.match(/^(\d+)(s|m|h|d|w)$/i);

    if (!match) return null;

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        w: 7 * 24 * 60 * 60 * 1000
    };

    return amount * multipliers[unit];
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);

    if (seconds < 60) {
        return seconds + "s";
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
        return minutes + "m";
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
        return hours + "h";
    }

    return Math.floor(hours / 24) + "d";
}


/* ========================= READY ========================= */

client.once("ready", () => {
    console.log(
        "PRLNGZZ DOG online as " +
        client.user.tag
    );

    client.user.setActivity("--help");
});


/* ========================= WELCOME ========================= */

client.on("guildMemberAdd", async (member) => {
    const channelId = data.welcomeChannels[member.guild.id];

    if (!channelId) return;

    const channel = member.guild.channels.cache.get(channelId);

    if (!channel) return;

    channel.send(
        "👋 Welcome **" +
        member.user.tag +
        "** to **" +
        member.guild.name +
        "**!"
    ).catch(() => {});
});


/* ========================= ANTI RAID ========================= */

const joinTracker = new Map();

client.on("guildMemberAdd", async (member) => {
    const guildId = member.guild.id;

    if (!joinTracker.has(guildId)) {
        joinTracker.set(guildId, []);
    }

    const joins = joinTracker.get(guildId);
    const now = Date.now();

    joins.push(now);

    while (joins.length && now - joins[0] > 10000) {
        joins.shift();
    }

    if (joins.length >= 5) {
        data.raidMode[guildId] = true;
        saveData();

        const owner = await member.guild.fetchOwner().catch(() => null);

        if (owner) {
            owner.send(
                "🚨 **ANTI-RAID ALERT**\n" +
                "5+ members joined within 10 seconds.\n" +
                "Raid mode has been enabled."
            ).catch(() => {});
        }

        setTimeout(() => {
            data.raidMode[guildId] = false;
            saveData();
        }, 60000);
    }

    if (data.raidMode[guildId]) {
        try {
            if (
                member.guild.members.me &&
                member.guild.members.me.permissions.has(
                    PermissionsBitField.Flags.KickMembers
                )
            ) {
                await member.kick("Anti-raid protection");
            }
        } catch (error) {
            console.log("Anti-raid kick failed:", error.message);
        }
    }
});


/* ========================= ANTI SPAM ========================= */

const spamTracker = new Map();

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    if (
        message.member &&
        message.member.permissions.has(
            PermissionsBitField.Flags.ManageMessages
        )
    ) {
        return;
    }

    const key = getUserKey(
        message.guild.id,
        message.author.id
    );

    if (!spamTracker.has(key)) {
        spamTracker.set(key, []);
    }

    const messages = spamTracker.get(key);
    const now = Date.now();

    messages.push(now);

    while (
        messages.length &&
        now - messages[0] > 6000
    ) {
        messages.shift();
    }

    if (messages.length >= 8) {
        messages.length = 0;

        try {
            if (
                message.member &&
                message.member.moderatable
            ) {
                await message.member.timeout(
                    15000,
                    "Anti-spam"
                );

                await message.channel.send(
                    "🛑 " +
                    message.author +
                    " was timed out for spam."
                );
            }
        } catch (error) {
            console.log(
                "Anti-spam error:",
                error.message
            );
        }
    }
});


/* ========================= MAIN COMMAND HANDLER ========================= */

client.on("messageCreate", async (message) => {

    if (message.author.bot) return;
    if (!message.guild) return;

    if (!message.content.startsWith(PREFIX)) {
        /* ========================= AUTOMOD ========================= */

        const inviteRegex =
            /(discord\.gg\/|discord\.com\/invite\/)/i;

        const mentionCount =
            message.mentions.users.size;

        if (
            inviteRegex.test(message.content) ||
            mentionCount >= 6
        ) {
            if (
                message.member &&
                !message.member.permissions.has(
                    PermissionsBitField.Flags.ManageMessages
                )
            ) {
                try {
                    await message.delete();

                    await message.channel.send(
                        "🛡️ " +
                        message.author +
                        " your message was removed by automod."
                    ).then(msg => {
                        setTimeout(() => {
                            msg.delete().catch(() => {});
                        }, 5000);
                    });
                } catch (error) {
                    console.log(
                        "Automod error:",
                        error.message
                    );
                }
            }
        }

        return;
    }

    const args = message.content
        .slice(PREFIX.length)
        .trim()
        .split(/\s+/);

    const cmd = args.shift().toLowerCase();


    /* ========================= HELP ========================= */

    if (cmd === "help") {
        return message.reply(
            "🤖 **PRLNGZZ DOG COMMANDS**\n\n" +

            "**Moderation**\n" +
            "`--ban @user [reason]`\n" +
            "`--unban userID`\n" +
            "`--kick @user [reason]`\n" +
            "`--mute @user 10s`\n" +
            "`--unmute @user`\n" +
            "`--timeout @user 10m`\n" +
            "`--warn @user [reason]`\n" +
            "`--warnings @user`\n" +
            "`--clearwarnings @user`\n" +
            "`--clear 10`\n" +
            "`--purge 10`\n" +
            "`--lock`\n" +
            "`--unlock`\n" +
            "`--slowmode 10`\n" +
            "`--nick @user nickname`\n" +
            "`--userinfo @user`\n" +
            "`--serverinfo`\n" +
            "`--say message`\n" +
            "`--role @user customer`\n\n" +

            "**Server**\n" +
            "`--setup`\n" +
            "`--setwelcome #channel`\n" +
            "`--ticketsetup #category`\n" +
            "`--giveaway 10m 1 500 Robux`"
        );
    }


    /* ========================= SETUP ========================= */

    if (cmd === "setup") {
        if (
            !hasPermission(
                message,
                PermissionsBitField.Flags.Administrator
            )
        ) {
            return message.reply(
                "❌ You need **Administrator**."
            );
        }

        return message.reply(
            "⚙️ **PRLNGZZ DOG SETUP**\n\n" +
            "`--setwelcome #channel`\n" +
            "`--ticketsetup #category`\n" +
            "`--giveaway 10m 1 500 Robux`\n\n" +
            "**Moderation**\n" +
            "`--ban @user reason`\n" +
            "`--kick @user reason`\n" +
            "`--mute @user 10s`\n" +
            "`--timeout @user 10m`\n" +
            "`--warn @user reason`\n" +
            "`--clear 10`\n" +
            "`--lock`\n" +
            "`--unlock`\n" +
            "`--slowmode 10`"
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

        const members = Array.from(
            message.mentions.members.values()
        );

        if (!members.length) {
            return message.reply(
                "❌ Usage: `--ban @user @user2 [reason]`"
            );
        }

        const reason = args
            .filter(function (arg) {
                return !arg.startsWith("<@");
            })
            .join(" ")
            .trim() || "No reason provided";

        const banned = [];
        const failed = [];

        for (const member of members) {
            if (!member.bannable) {
                failed.push(member.user.tag);
                continue;
            }

            try {
                await member.ban({
                    reason: reason
                });

                banned.push(member.user.tag);
            } catch (error) {
                console.log(
                    "Failed to ban " +
                    member.user.tag +
                    ":",
                    error
                );

                failed.push(member.user.tag);
            }
        }

        await deleteCommand(message);

        let response = "";

        if (banned.length) {
            response +=
                "🔨 Banned **" +
                banned.join("**, **") +
                "**.";

            if (reason !== "No reason provided") {
                response +=
                    "\nReason: **" +
                    reason +
                    "**";
            }
        }

        if (failed.length) {
            if (response) response += "\n\n";

            response +=
                "❌ Couldn't ban **" +
                failed.join("**, **") +
                "**.";
        }

        return message.channel.send(response);
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
                "❌ Usage: `--unban userID`"
            );
        }

        try {
            await message.guild.members.unban(userId);

            await deleteCommand(message);

            return message.channel.send(
                "🔓 Unbanned **" +
                userId +
                "**."
            );
        } catch (error) {
            return message.reply(
                "❌ Couldn't unban that user."
            );
        }
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

        const members = Array.from(
            message.mentions.members.values()
        );

        if (!members.length) {
            return message.reply(
                "❌ Usage: `--kick @user [reason]`"
            );
        }

        const reason = args
            .filter(arg => !arg.startsWith("<@"))
            .join(" ")
            .trim() || "No reason provided";

        const kicked = [];
        const failed = [];

        for (const member of members) {
            if (!member.kickable) {
                failed.push(member.user.tag);
                continue;
            }

            try {
                await member.kick(reason);
                kicked.push(member.user.tag);
            } catch (error) {
                failed.push(member.user.tag);
            }
        }

        await deleteCommand(message);

        let response = "";

        if (kicked.length) {
            response =
                "👢 Kicked **" +
                kicked.join("**, **") +
                "**.";

            if (reason !== "No reason provided") {
                response +=
                    "\nReason: **" +
                    reason +
                    "**";
            }
        }

        if (failed.length) {
            if (response) response += "\n\n";

            response +=
                "❌ Couldn't kick **" +
                failed.join("**, **") +
                "**.";
        }

        return message.channel.send(response);
    }


    /* ========================= MUTE ========================= */

    if (cmd === "mute") {
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
            message.mentions.members.first();

        const duration =
            parseDuration(args.find(arg =>
                /^\d+(s|m|h|d|w)$/i.test(arg)
            ));

        if (!member || !duration) {
            return message.reply(
                "❌ Usage: `--mute @user 10s`"
            );
        }

        try {
            await member.timeout(
                duration,
                "Muted by moderator"
            );

            await deleteCommand(message);

            return message.channel.send(
                "🔇 Muted **" +
                member.user.tag +
                "** for **" +
                formatDuration(duration) +
                "**."
            );
        } catch (error) {
            console.log(error);

            return message.reply(
                "❌ Couldn't mute that user."
            );
        }
    }


    /* ========================= UNMUTE ========================= */

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
            message.mentions.members.first();

        if (!member) {
            return message.reply(
                "❌ Usage: `--unmute @user`"
            );
        }

        try {
            await member.timeout(null);

            await deleteCommand(message);

            return message.channel.send(
                "🔊 Unmuted **" +
                member.user.tag +
                "**."
            );
        } catch (error) {
            return message.reply(
                "❌ Couldn't unmute that user."
            );
        }
    }


    /* ========================= TIMEOUT ========================= */

    if (cmd === "timeout") {
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
            message.mentions.members.first();

        const duration =
            parseDuration(args.find(arg =>
                /^\d+(s|m|h|d|w)$/i.test(arg)
            ));

        if (!member || !duration) {
            return message.reply(
                "❌ Usage: `--timeout @user 10m`"
            );
        }

        try {
            await member.timeout(
                duration,
                "Timed out by moderator"
            );

            await deleteCommand(message);

            return message.channel.send(
                "⏱️ Timed out **" +
                member.user.tag +
                "** for **" +
                formatDuration(duration) +
                "**."
            );
        } catch (error) {
            return message.reply(
                "❌ Couldn't timeout that user."
            );
        }
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
            message.mentions.members.first();

        if (!member) {
            return message.reply(
                "❌ Usage: `--warn @user [reason]`"
            );
        }

        const reason = args
            .filter(arg => !arg.startsWith("<@"))
            .join(" ")
            .trim() || "No reason provided";

        const key = getUserKey(
            message.guild.id,
            member.id
        );

        if (!data.warnings[key]) {
            data.warnings[key] = [];
        }

        data.warnings[key].push({
            reason: reason,
            moderator: message.author.id,
            date: Date.now()
        });

        saveData();

        await deleteCommand(message);

        return message.channel.send(
            "⚠️ Warned **" +
            member.user.tag +
            "**.\nReason: **" +
            reason +
            "**"
        );
    }


    /* ========================= WARNINGS ========================= */

    if (cmd === "warnings") {
        const member =
            message.mentions.members.first() ||
            message.member;

        const key = getUserKey(
            message.guild.id,
            member.id
        );

        const warnings =
            data.warnings[key] || [];

        if (!warnings.length) {
            return message.reply(
                "✅ **" +
                member.user.tag +
                "** has no warnings."
            );
        }

        let output =
            "⚠️ **Warnings for " +
            member.user.tag +
            "**\n\n";

        warnings.forEach((warning, index) => {
            output +=
                "**" +
                (index + 1) +
                ".** " +
                warning.reason +
                "\n";
        });

        return message.reply(output);
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
            message.mentions.members.first();

        if (!member) {
            return message.reply(
                "❌ Usage: `--clearwarnings @user`"
            );
        }

        const key = getUserKey(
            message.guild.id,
            member.id
        );

        delete data.warnings[key];

        saveData();

        return message.reply(
            "🧹 Cleared warnings for **" +
            member.user.tag +
            "**."
        );
    }


    /* ========================= CLEAR ========================= */

    if (cmd === "clear" || cmd === "purge") {
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

        const amount = parseInt(args[0]);

        if (
            isNaN(amount) ||
            amount < 1 ||
            amount > 100
        ) {
            return message.reply(
                "❌ Usage: `--clear 10`"
            );
        }

        try {
            const deleted =
                await message.channel.bulkDelete(
                    amount + 1,
                    true
                );

            const msg =
                await message.channel.send(
                    "🧹 Deleted **" +
                    (deleted.size - 1) +
                    "** messages."
                );

            setTimeout(() => {
                msg.delete().catch(() => {});
            }, 3000);
        } catch (error) {
            return message.reply(
                "❌ Couldn't delete those messages."
            );
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

        try {
            await message.channel.permissionOverwrites.edit(
                message.guild.roles.everyone,
                {
                    SendMessages: false
                }
            );

            return message.channel.send(
                "🔒 Channel locked."
            );
        } catch (error) {
            return message.reply(
                "❌ Couldn't lock this channel."
            );
        }
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

        try {
            await message.channel.permissionOverwrites.edit(
                message.guild.roles.everyone,
                {
                    SendMessages: null
                }
            );

            return message.channel.send(
                "🔓 Channel unlocked."
            );
        } catch (error) {
            return message.reply(
                "❌ Couldn't unlock this channel."
            );
        }
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

        const seconds = parseInt(args[0]);

        if (
            isNaN(seconds) ||
            seconds < 0 ||
            seconds > 21600
        ) {
            return message.reply(
                "❌ Use a number between `0` and `21600`."
            );
        }

        try {
            await message.channel.setRateLimitPerUser(
                seconds
            );

            return message.channel.send(
                "🐌 Slowmode set to **" +
                seconds +
                " seconds**."
            );
        } catch (error) {
            return message.reply(
                "❌ Couldn't set slowmode."
            );
        }
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
            message.mentions.members.first();

        if (!member) {
            return message.reply(
                "❌ Usage: `--nick @user nickname`"
            );
        }

        const nickname = args
            .filter(arg => !arg.startsWith("<@"))
            .join(" ");

        if (!nickname) {
            return message.reply(
                "❌ Give a nickname."
            );
        }

        try {
            await member.setNickname(nickname);

            return message.reply(
                "✏️ Nickname changed for **" +
                member.user.tag +
                "**."
            );
        } catch (error) {
            return message.reply(
                "❌ Couldn't change nickname."
            );
        }
    }


    /* ========================= USERINFO ========================= */

    if (cmd === "userinfo") {
        const member =
            message.mentions.members.first() ||
            message.member;

        return message.reply(
            "👤 **USER INFO**\n\n" +
            "**User:** " +
            member.user.tag +
            "\n" +
            "**ID:** " +
            member.id +
            "\n" +
            "**Joined:** " +
            member.joinedAt.toISOString()
        );
    }


    /* ========================= SERVERINFO ========================= */

    if (cmd === "serverinfo") {
        return message.reply(
            "🏠 **SERVER INFO**\n\n" +
            "**Name:** " +
            message.guild.name +
            "\n" +
            "**Members:** " +
            message.guild.memberCount +
            "\n" +
            "**Channels:** " +
            message.guild.channels.cache.size +
            "\n" +
            "**Roles:** " +
            message.guild.roles.cache.size +
            "\n" +
            "**Owner:** " +
            message.guild.ownerId
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

        const text = message.content
            .slice(PREFIX.length + 3)
            .trim();

        if (!text) {
            return message.reply(
                "❌ Usage: `--say your message`"
            );
        }

        await deleteCommand(message);

        return message.channel.send(text);
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
            message.mentions.members.first();

        const roleName = args
            .filter(arg => !arg.startsWith("<@"))
            .join(" ")
            .trim();

        if (!member || !roleName) {
            return message.reply(
                "❌ Usage: `--role @user customer`"
            );
        }

        const role =
            message.guild.roles.cache.find(
                r =>
                    r.name.toLowerCase() ===
                    roleName.toLowerCase()
            );

        if (!role) {
            return message.reply(
                "❌ Role not found."
            );
        }

        try {
            await member.roles.add(role);

            return message.reply(
                "✅ Added **" +
                role.name +
                "** to **" +
                member.user.tag +
                "**."
            );
        } catch (error) {
            return message.reply(
                "❌ Couldn't add that role."
            );
        }
    }


    /* ========================= WELCOME SETUP ========================= */

    if (cmd === "setwelcome") {
        if (
            !hasPermission(
                message,
                PermissionsBitField.Flags.Administrator
            )
        ) {
            return message.reply(
                "❌ You need **Administrator**."
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
            "👋 Welcome channel set to " +
            channel +
            "."
        );
    }


    /* ========================= TICKET SETUP ========================= */

    if (cmd === "ticketsetup") {
        if (
            !hasPermission(
                message,
                PermissionsBitField.Flags.Administrator
            )
        ) {
            return message.reply(
                "❌ You need **Administrator**."
            );
        }

        const category =
            message.mentions.channels.first();

        if (!category) {
            return message.reply(
                "❌ Usage: `--ticketsetup #category`"
            );
        }

        data.ticketCategories[
            message.guild.id
        ] = category.id;

        saveData();

        return message.reply(
            "🎫 Ticket category set to " +
            category + "."
        );
    }


    /* ========================= GIVEAWAY ========================= */

    if (cmd === "giveaway") {
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

        const duration =
            parseDuration(args[0]);

        const winners =
            parseInt(args[1]);

        const prize =
            args.slice(2).join(" ");

        if (
            !duration ||
            !winners ||
            !prize
        ) {
            return message.reply(
                "❌ Usage: `--giveaway 10m 1 500 Robux`"
            );
        }

        const end =
            Date.now() + duration;

        const giveawayMessage =
            await message.channel.send(
                "🎉 **GIVEAWAY** 🎉\n\n" +
                "**Prize:** " +
                prize +
                "\n" +
                "**Winners:** " +
                winners +
                "\n" +
                "**Ends:** <t:" +
                Math.floor(end / 1000) +
                ":R>\n\n" +
                "React with 🎉 to enter!"
            );

        await giveawayMessage.react("🎉");

        setTimeout(async () => {
            try {
                const fetched =
                    await message.channel.messages.fetch(
                        giveawayMessage.id
                    );

                const reaction =
                    fetched.reactions.cache.get("🎉");

                if (!reaction) {
                    return message.channel.send(
                        "🎉 Giveaway ended but nobody entered."
                    );
                }

                const users =
                    await reaction.users.fetch();

                const entries =
                    users.filter(
                        user =>
                            !user.bot
                    );

                if (!entries.size) {
                    return message.channel.send(
                        "🎉 Giveaway ended but nobody entered."
                    );
                }

                const array =
                    Array.from(entries.values());

                const selected = [];

                while (
                    selected.length < winners &&
                    array.length
                ) {
                    const index =
                        Math.floor(
                            Math.random() *
                            array.length
                        );

                    selected.push(
                        array.splice(index, 1)[0]
                    );
                }

                return message.channel.send(
                    "🎉 **GIVEAWAY ENDED!**\n\n" +
                    "**Prize:** " +
                    prize +
                    "\n" +
                    "**Winner(s):** " +
                    selected
                        .map(user => user.toString())
                        .join(", ")
                );
            } catch (error) {
                console.log(
                    "Giveaway error:",
                    error
                );
            }
        }, duration);

        return;
    }


    /* ========================= UNKNOWN COMMAND ========================= */

    return;
});


/* ========================= LOGIN ========================= */

client.login(process.env.DISCORD_TOKEN);
