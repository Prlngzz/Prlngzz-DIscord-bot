const { Client, GatewayIntentBits, PermissionsBitField } = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const PREFIX = "--";

client.once("ready", function () {
    console.log("bot is online");
});

client.on("messageCreate", async function (message) {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.content.startsWith(PREFIX)) return;

    // only admins can use commands
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return;
    }

    const input = message.content.substring(PREFIX.length);

    // =========================
    // --say
    // =========================

    if (input.startsWith("say")) {
        const text = input.substring(3).trim();

        if (!text) {
            return message.reply("usage: --say your message");
        }

        await message.delete().catch(function () {});

        // keeps line breaks exactly as typed
        return message.channel.send({
            content: text,
            allowedMentions: {
                parse: ["users", "roles", "everyone"]
            }
        });
    }

    // =========================
    // --role @user customer
    // =========================

    if (input.startsWith("role")) {
        const args = input.substring(4).trim().split(/\s+/);

        if (args.length < 2) {
            return message.reply("usage: --role @user customer");
        }

        const userMention = args[0];
        const roleName = args.slice(1).join(" ");

        const userId = userMention.replace(/[<@!>]/g, "");

        const member = await message.guild.members.fetch(userId).catch(function () {
            return null;
        });

        if (!member) {
            return message.reply("couldnt find that user bro 😭");
        }

        const role = message.guild.roles.cache.find(function (r) {
            return r.name.toLowerCase() === roleName.toLowerCase();
        });

        if (!role) {
            return message.reply("couldnt find the role: " + roleName);
        }

        if (role.managed) {
            return message.reply("that role is managed by Discord");
        }

        if (role.position >= message.guild.members.me.roles.highest.position) {
            return message.reply("that role is above my highest role");
        }

        try {
            await member.roles.add(role);

            return message.reply(
                "gave " + member.user.tag + " the " + role.name + " role"
            );
        } catch (error) {
            console.error(error);
            return message.reply("couldnt give the role 😭");
        }
    }

    // =========================
    // --kick @user
    // =========================

    if (input.startsWith("kick")) {
        const args = input.substring(4).trim().split(/\s+/);
        const userId = args[0] ? args[0].replace(/[<@!>]/g, "") : null;

        if (!userId) {
            return message.reply("usage: --kick @user");
        }

        const member = await message.guild.members.fetch(userId).catch(function () {
            return null;
        });

        if (!member) {
            return message.reply("user not found");
        }

        try {
            await member.kick();
            return message.reply("kicked " + member.user.tag);
        } catch (error) {
            return message.reply("couldnt kick that user");
        }
    }

    // =========================
    // --ban @user
    // =========================

    if (input.startsWith("ban")) {
        const args = input.substring(3).trim().split(/\s+/);
        const userId = args[0] ? args[0].replace(/[<@!>]/g, "") : null;

        if (!userId) {
            return message.reply("usage: --ban @user");
        }

        const member = await message.guild.members.fetch(userId).catch(function () {
            return null;
        });

        if (!member) {
            return message.reply("user not found");
        }

        try {
            await member.ban();
            return message.reply("banned " + member.user.tag);
        } catch (error) {
            return message.reply("couldnt ban that user");
        }
    }

    // =========================
    // --warn @user reason
    // =========================

    if (input.startsWith("warn")) {
        const args = input.substring(4).trim().split(/\s+/);
        const userId = args[0] ? args[0].replace(/[<@!>]/g, "") : null;

        if (!userId) {
            return message.reply("usage: --warn @user reason");
        }

        const member = await message.guild.members.fetch(userId).catch(function () {
            return null;
        });

        if (!member) {
            return message.reply("user not found");
        }

        const reason = args.slice(1).join(" ") || "no reason given";

        return message.reply(
            "⚠️ warned " + member.user.tag + " | " + reason
        );
    }

    // =========================
    // --clear 10
    // =========================

    if (input.startsWith("clear")) {
        const amount = parseInt(input.substring(5).trim());

        if (!amount || amount < 1 || amount > 100) {
            return message.reply("usage: --clear 10");
        }

        await message.channel.bulkDelete(amount, true);

        const msg = await message.channel.send(
            "deleted " + amount + " messages"
        );

        setTimeout(function () {
            msg.delete().catch(function () {});
        }, 3000);

        return;
    }

    // =========================
    // --lock
    // =========================

    if (input === "lock") {
        await message.channel.permissionOverwrites.edit(
            message.guild.roles.everyone,
            {
                SendMessages: false
            }
        );

        return message.reply("🔒 channel locked");
    }

    // =========================
    // --unlock
    // =========================

    if (input === "unlock") {
        await message.channel.permissionOverwrites.edit(
            message.guild.roles.everyone,
            {
                SendMessages: true
            }
        );

        return message.reply("🔓 channel unlocked");
    }
});
client.login(process.env.DISCORD_TOKEN);
