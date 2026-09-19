const {
    Client,
    GatewayIntentBits,
    PermissionsBitField
} = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const PREFIX = "--";
const TOKEN = "PUT_YOUR_BOT_TOKEN_HERE";

client.once("ready", () => {
    console.log(`${client.user.tag} is online`);
});

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.content.startsWith(PREFIX)) return;

    // ONLY SERVER ADMINS CAN USE COMMANDS
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return;
    }

    const input = message.content.slice(PREFIX.length);

    // -------------------------
    // --say
    // -------------------------
    if (input.startsWith("say")) {
        const text = input.slice(3).trim();

        if (!text) {
            return message.reply("usage: `--say your message`");
        }

        // Keeps every newline exactly how the user typed it
        await message.delete().catch(() => {});

        return message.channel.send({
            content: text,
            allowedMentions: {
                parse: ["users", "roles", "everyone"]
            }
        });
    }

    // -------------------------
    // --role @user role
    // format:
    // --role @user customer
    // -------------------------
    if (input.startsWith("role")) {
        const args = input.slice(4).trim().split(/\s+/);

        if (args.length < 2) {
            return message.reply(
                "usage: `--role @user customer`"
            );
        }

        const userMention = args[0];
        const roleName = args.slice(1).join(" ");

        const userId = userMention.replace(/[<@!>]/g, "");

        const member = await message.guild.members
            .fetch(userId)
            .catch(() => null);

        if (!member) {
            return message.reply("couldnt find that user bro 😭");
        }

        const role = message.guild.roles.cache.find(
            r => r.name.toLowerCase() === roleName.toLowerCase()
        );

        if (!role) {
            return message.reply(`couldnt find the role \`${roleName}\``);
        }

        if (role.position >= message.guild.members.me.roles.highest.position) {
            return message.reply(
                "i cant give that role because its above my highest role"
            );
        }

        if (role.managed) {
            return message.reply("that role is managed by Discord.");
        }

        try {
            await member.roles.add(role);

            return message.reply(
                `gave ${member} the **${role.name}** role`
            );
        } catch (error) {
            console.error(error);
            return message.reply("couldnt give the role tf 😭");
        }
    }

    // -------------------------
    // --kick
    // -------------------------
    if (input.startsWith("kick")) {
        const args = input.slice(4).trim().split(/\s+/);
        const userId = args[0]?.replace(/[<@!>]/g, "");

        if (!userId) return message.reply("usage: `--kick @user`");

        const member = await message.guild.members
            .fetch(userId)
            .catch(() => null);

        if (!member) return message.reply("user not found");

        await member.kick().catch(() => null);

        return message.reply(`kicked ${member.user.tag}`);
    }

    // -------------------------
    // --ban
    // -------------------------
    if (input.startsWith("ban")) {
        const args = input.slice(3).trim().split(/\s+/);
        const userId = args[0]?.replace(/[<@!>]/g, "");

        if (!userId) return message.reply("usage: `--ban @user`");

        const member = await message.guild.members
            .fetch(userId)
            .catch(() => null);

        if (!member) return message.reply("user not found");

        await member.ban().catch(() => null);

        return message.reply(`banned ${member.user.tag}`);
    }

    // -------------------------
    // --clear
    // -------------------------
    if (input.startsWith("clear")) {
        const amount = parseInt(input.slice(5).trim());

        if (!amount || amount < 1 || amount > 100) {
            return message.reply("usage: `--clear 10`");
        }

        await message.channel.bulkDelete(amount, true);

        const msg = await message.channel.send(
            `deleted ${amount} messages`
        );

        setTimeout(() => msg.delete().catch(() => {}), 3000);
    }

    // -------------------------
    // --lock
    // -------------------------
    if (input === "lock") {
        await message.channel.permissionOverwrites.edit(
            message.guild.roles.everyone,
            {
                SendMessages: false
            }
        );

        return message.reply("🔒 channel locked");
    }

    // -------------------------
    // --unlock
    // -------------------------
    if (input === "unlock") {
        await message.channel.permissionOverwrites.edit(
            message.guild.roles.everyone,
            {
                SendMessages: true
            }
        );

        return message.reply("🔓 channel unlocked");
    }

    // -------------------------
    // --warn
    // -------------------------
    if (input.startsWith("warn")) {
        const args = input.slice(4).trim().split(/\s+/);
        const userId = args[0]?.replace(/[<@!>]/g, "");

        if (!userId) return message.reply("usage: `--warn @user reason`");

        const member = await message.guild.members
            .fetch(userId)
            .catch(() => null);

        if (!member) return message.reply("user not found");

        const reason = args.slice(1).join(" ") || "no reason given";

        return message.reply(
            `⚠️ warned ${member} | ${reason}`
        );
    }
});

client.login(TOKEN);
