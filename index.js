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
  } catch {
    console.log("Could not read data file. Using fresh data.");
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.log("Could not save data:", err);
  }
}

const spamTracker = new Map();
const raidTracker = new Map();
const giveaways = new Map();

function hasPermission(message, permission) {
  return message.member?.permissions.has(permission);
}

function getUser(message, arg) {
  if (!arg) return null;

  const mentioned = message.mentions.members.first();
  if (mentioned) return mentioned;

  return message.guild?.members.cache.get(arg);
}

function parseDuration(input) {
  if (!input) return null;

  const match = input.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return amount * multipliers[unit];
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);

  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours}h`;

  return `${Math.floor(hours / 24)}d`;
}

/* =========================
   READY
========================= */

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);

  client.user.setActivity("Fleasion | --help");

  console.log("Fleasion Bot is online.");
});

/* =========================
   MEMBER JOIN
========================= */

client.on("guildMemberAdd", async member => {
  const guildId = member.guild.id;

  if (!raidTracker.has(guildId)) {
    raidTracker.set(guildId, []);
  }

  const joins = raidTracker.get(guildId);

  joins.push(Date.now());

  const recentJoins = joins.filter(time => Date.now() - time < 10000);

  raidTracker.set(guildId, recentJoins);

  if (recentJoins.length >= 5 && !data.raidMode[guildId]) {
    data.raidMode[guildId] = true;
    saveData();

    try {
      await member.guild.owner?.send(
        `🚨 RAID ALERT\n\n5 or more members joined within 10 seconds in **${member.guild.name}**.\n\nRaid mode has been activated for 60 seconds.`
      );
    } catch {}

    setTimeout(() => {
      data.raidMode[guildId] = false;
      saveData();
    }, 60000);
  }

  const welcomeChannelId = data.welcomeChannels[guildId];

  if (welcomeChannelId) {
    const channel = member.guild.channels.cache.get(welcomeChannelId);

    if (channel) {
      channel.send(
        `👋 welcome ${member.user} to **${member.guild.name}**!`
      ).catch(() => {});
    }
  }
});

/* =========================
   MESSAGE HANDLER
========================= */

client.on("messageCreate", async message => {
  if (!message.guild) return;
  if (message.author.bot) return;

  const content = message.content.trim();

  /* =========================
     ANTI-SPAM
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

    const messages = spamTracker.get(userId);

    messages.push(Date.now());

    const recentMessages = messages.filter(
      time => Date.now() - time < 6000
    );

    spamTracker.set(userId, recentMessages);

    if (recentMessages.length >= 8) {
      spamTracker.delete(userId);

      try {
        await message.member.timeout(
          15000,
          "Anti-spam: 8 messages within 6 seconds"
        );

        await message.channel.send(
          `🛑 ${message.author} has been timed out for **15 seconds** for spamming.`
        );
      } catch {}
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
          `🚫 ${message.author}, Discord invites are not allowed here.`
        );
      } catch {}

      return;
    }

    const mentions = message.mentions.users.size;

    if (mentions >= 6) {
      try {
        await message.delete();

        await message.channel.send(
          `🚫 ${message.author}, too many mentions.`
        );
      } catch {}

      return;
    }

    const letters = content.replace(/[^a-zA-Z]/g, "");

    if (letters.length >= 10) {
      const uppercase = letters.replace(/[^A-Z]/g, "").length;
      const percentage = uppercase / letters.length * 100;

      if (percentage >= 75) {
        try {
          await message.delete();

          await message.channel.send(
            `🚫 ${message.author}, please don't spam caps.`
          );
        } catch {}

        return;
      }
    }
  }

  /* =========================
     COMMAND CHECK
  ========================= */

  if (!content.startsWith(PREFIX)) return;

  const args = content
    .slice(PREFIX.length)
    .trim()
    .split(/\s+/);

  const command = args.shift()?.toLowerCase();

  if (!command) return;

  /* =========================
     SETUP
  ========================= */

  if (command === "setup") {
    return message.reply(
`⚙️ **FLEASION BOT SETUP**

━━━━━━━━━━━━━━━━━━━━

👋 **WELCOME**

\`--setwelcome #channel\`

Sets the welcome channel.

━━━━━━━━━━━━━━━━━━━━

🎫 **TICKETS**

\`--ticketsetup #category\`

Creates the ticket panel using the selected category.

Users click **Create Ticket** to open a private ticket.

━━━━━━━━━━━━━━━━━━━━

🎉 **GIVEAWAYS**

\`--giveaway 10m 1 500 Robux\`

\`--giveaway 1h 2 RIVALS Skin\`

\`--giveaway 1d 1 Skin Case\`

━━━━━━━━━━━━━━━━━━━━

🛡️ **PROTECTION**

✅ Automod: ON

✅ Anti-spam: **8 messages / 6 seconds → 15s timeout**

✅ Anti-raid: **5 joins / 10 seconds → owner alert**

━━━━━━━━━━━━━━━━━━━━

🔨 **MODERATION**

\`--ban @user\`

\`--unban USER_ID\`

\`--kick @user\`

\`--mute @user\`

\`--unmute @user\`

\`--timeout @user 10m\`

\`--warn @user reason\`

\`--warnings @user\`

\`--clearwarnings @user\`

\`--clear 10\`

\`--purge 10\`

\`--lock\`

\`--unlock\`

\`--slowmode 5\`

\`--nick @user NewName\`

━━━━━━━━━━━━━━━━━━━━

📊 **INFO**

\`--userinfo @user\`

\`--serverinfo\`

\`--say message\`

━━━━━━━━━━━━━━━━━━━━

❓ **HELP**

\`--help\`

\`--setup\`

━━━━━━━━━━━━━━━━━━━━

🐕 **Prlngzz Dog**

Fleasion protection & utilities`
    );
  }

  /* =========================
     HELP
  ========================= */

  if (command === "help") {
    return message.reply(
`🐕 **PRLNGZZ DOG**

**Moderation**
\`--ban @user\`
\`--unban USER_ID\`
\`--kick @user\`
\`--mute @user\`
\`--unmute @user\`
\`--timeout @user 10m\`
\`--warn @user reason\`
\`--warnings @user\`
\`--clearwarnings @user\`
\`--clear 10\`
\`--purge 10\`
\`--lock\`
\`--unlock\`
\`--slowmode 5\`
\`--nick @user Name\`

**Info**
\`--userinfo @user\`
\`--serverinfo\`
\`--say message\`

**Server**
\`--setwelcome #channel\`
\`--ticketsetup #category\`
\`--giveaway 10m 1 Prize\`

**Setup**
\`--setup\`

**Protection**
🛡️ Automod: ON
🛡️ Anti-spam: 8 / 6s → 15s timeout
🛡️ Anti-raid: 5 / 10s → owner alert`
    );
  }

  /* =========================
     SET WELCOME
  ========================= */

  if (command === "setwelcome") {
    if (
      !hasPermission(
        message,
        PermissionsBitField.Flags.ManageGuild
      )
    ) {
      return message.reply("❌ You need **Manage Server**.");
    }

    const channel = message.mentions.channels.first();

    if (!channel) {
      return message.reply(
        "❌ Usage: `--setwelcome #channel`"
      );
    }

    data.welcomeChannels[message.guild.id] = channel.id;
    saveData();

    return message.reply(
      `✅ Welcome channel set to ${channel}.`
    );
  }

  /* =========================
     WARN
  ========================= */

  if (command === "warn") {
    if (
      !hasPermission(
        message,
        PermissionsBitField.Flags.ModerateMembers
      )
    ) {
      return message.reply("❌ You need **Moderate Members**.");
    }

    const member = getUser(message, args[0]);

    if (!member) {
      return message.reply(
        "❌ Usage: `--warn @user reason`"
      );
    }

    const reason =
      args.slice(1).join(" ") || "No reason provided";

    const guildId = message.guild.id;
    const userId = member.id;

    if (!data.warnings[guildId]) {
      data.warnings[guildId] = {};
    }

    if (!data.warnings[guildId][userId]) {
      data.warnings[guildId][userId] = [];
    }

    data.warnings[guildId][userId].push({
      reason,
      moderator: message.author.id,
      timestamp: Date.now()
    });

    saveData();

    return message.reply(
      `⚠️ ${member} has been warned.\nReason: **${reason}**\nTotal warnings: **${data.warnings[guildId][userId].length}**`
    );
  }

  /* =========================
     WARNINGS
  ========================= */

  if (command === "warnings") {
    const member = getUser(message, args[0]);

    if (!member) {
      return message.reply(
        "❌ Usage: `--warnings @user`"
      );
    }

    const guildWarnings =
      data.warnings[message.guild.id] || {};

    const warnings = guildWarnings[member.id] || [];

    if (warnings.length === 0) {
      return message.reply(
        `✅ ${member} has no warnings.`
      );
    }

    const text = warnings
      .map(
        (warning, index) =>
          `**${index + 1}.** ${warning.reason}`
      )
      .join("\n");

    return message.reply(
      `⚠️ **Warnings for ${member}**\n\n${text}`
    );
  }

  /* =========================
     CLEAR WARNINGS
  ========================= */

  if (
    command === "clearwarnings" ||
    command === "unwarn"
  ) {
    if (
      !hasPermission(
        message,
        PermissionsBitField.Flags.ModerateMembers
      )
    ) {
      return message.reply("❌ You need **Moderate Members**.");
    }

    const member = getUser(message, args[0]);

    if (!member) {
      return message.reply(
        "❌ Usage: `--clearwarnings @user`"
      );
    }

    if (data.warnings[message.guild.id]) {
      delete data.warnings[message.guild.id][member.id];
      saveData();
    }

    return message.reply(
      `✅ Cleared all warnings for ${member}.`
    );
  }

  /* =========================
     BAN
  ========================= */

  if (command === "ban") {
    if (
      !hasPermission(
        message,
        PermissionsBitField.Flags.BanMembers
      )
    ) {
      return message.reply("❌ You need **Ban Members**.");
    }

    const member = getUser(message, args[0]);

    if (!member) {
      return message.reply(
        "❌ Usage: `--ban @user`"
      );
    }

    if (!member.bannable) {
      return message.reply(
        "❌ I can't ban that member. Check my role position and permissions."
      );
    }

    const reason =
      args.slice(1).join(" ") || "No reason provided";

    await member.ban({ reason });

    return message.reply(
      `🔨 Banned **${member.user.tag}**\nReason: ${reason}`
    );
  }

  /* =========================
     UNBAN
  ========================= */

  if (command === "unban") {
    if (
      !hasPermission(
        message,
        PermissionsBitField.Flags.BanMembers
      )
    ) {
      return message.reply("❌ You need **Ban Members**.");
    }

    const userId = args[0];

    if (!userId) {
      return message.reply(
        "❌ Usage: `--unban USER_ID`"
      );
    }

    try {
      await message.guild.members.unban(userId);

      return message.reply(
        `✅ Unbanned user \`${userId}\`.`
      );
    } catch {
      return message.reply(
        "❌ Could not unban that user."
      );
    }
  }

  /* =========================
     KICK
  ========================= */

  if (command === "kick") {
    if (
      !hasPermission(
        message,
        PermissionsBitField.Flags.KickMembers
      )
    ) {
      return message.reply("❌ You need **Kick Members**.");
    }

    const member = getUser(message, args[0]);

    if (!member) {
      return message.reply(
        "❌ Usage: `--kick @user`"
      );
    }

    if (!member.kickable) {
      return message.reply(
        "❌ I can't kick that member."
      );
    }

    const reason =
      args.slice(1).join(" ") || "No reason provided";

    await member.kick(reason);

    return message.reply(
      `👢 Kicked **${member.user.tag}**\nReason: ${reason}`
    );
  }

  /* =========================
     MUTE
  ========================= */

  if (
    command === "mute" ||
    command === "timeout"
  ) {
    if (
      !hasPermission(
        message,
        PermissionsBitField.Flags.ModerateMembers
      )
    ) {
      return message.reply("❌ You need **Moderate Members**.");
    }

    const member = getUser(message, args[0]);

    if (!member) {
      return message.reply(
        "❌ Usage: `--mute @user` or `--timeout @user 10m`"
      );
    }

    let duration = 10 * 60 * 1000;

    if (args[1]) {
      const parsed = parseDuration(args[1]);

      if (parsed) {
        duration = parsed;
      }
    }

    if (duration > 28 * 24 * 60 * 60 * 1000) {
      return message.reply(
        "❌ Discord only allows timeouts up to 28 days."
      );
    }

    await member.timeout(
      duration,
      args.slice(2).join(" ") || "Moderator timeout"
    );

    return message.reply(
      `🔇 ${member} has been timed out for **${formatDuration(duration)}**.`
    );
  }

  /* =========================
     UNMUTE
  ========================= */

  if (command === "unmute") {
    if (
      !hasPermission(
        message,
        PermissionsBitField.Flags.ModerateMembers
      )
    ) {
      return message.reply("❌ You need **Moderate Members**.");
    }

    const member = getUser(message, args[0]);

    if (!member) {
      return message.reply(
        "❌ Usage: `--unmute @user`"
      );
    }

    await member.timeout(null);

    return message.reply(
      `🔊 ${member} has been unmuted.`
    );
  }

  /* =========================
     CLEAR / PURGE
  ========================= */

  if (
    command === "clear" ||
    command === "purge"
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

    const amount = Number(args[0]);

    if (!amount || amount < 1 || amount > 100) {
      return message.reply(
        "❌ Choose a number from **1 to 100**."
      );
    }

    const deleted =
      await message.channel.bulkDelete(amount, true);

    return message.channel.send(
      `🧹 Deleted **${deleted.size}** messages.`
    );
  }

  /* =========================
     LOCK
  ========================= */

  if (command === "lock") {
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
    );

    return message.reply("🔒 Channel locked.");
  }

  /* =========================
     UNLOCK
  ========================= */

  if (command === "unlock") {
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
    );

    return message.reply("🔓 Channel unlocked.");
  }

  /* =========================
     SLOWMODE
  ========================= */

  if (command === "slowmode") {
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

    const seconds = Number(args[0]);

    if (
      Number.isNaN(seconds) ||
      seconds < 0 ||
      seconds > 21600
    ) {
      return message.reply(
        "❌ Slowmode must be between 0 and 21600 seconds."
      );
    }

    await message.channel.setRateLimitPerUser(seconds);

    return message.reply(
      `🐌 Slowmode set to **${seconds}s**.`
    );
  }

  /* =========================
     NICK
  ========================= */

  if (command === "nick") {
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

    const member = getUser(message, args[0]);

    if (!member) {
      return message.reply(
        "❌ Usage: `--nick @user NewName`"
      );
    }

    const nickname = args.slice(1).join(" ");

    if (!nickname) {
      return message.reply(
        "❌ Give me a nickname."
      );
    }

    await member.setNickname(nickname);

    return message.reply(
      `✅ Changed ${member}'s nickname to **${nickname}**.`
    );
  }

  /* =========================
     USERINFO
  ========================= */

  if (command === "userinfo") {
    const member = getUser(message, args[0]) || message.member;

    return message.reply(
`👤 **USER INFO**

Username: **${member.user.tag}**
ID: \`${member.id}\`
Joined: <t:${Math.floor(member.joinedTimestamp / 1000)}:R>
Account: <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`
    );
  }

  /* =========================
     SERVERINFO
  ========================= */

  if (command === "serverinfo") {
    return message.reply(
`🏠 **SERVER INFO**

Name: **${message.guild.name}**
ID: \`${message.guild.id}\`
Members: **${message.guild.memberCount}**
Channels: **${message.guild.channels.cache.size}**
Roles: **${message.guild.roles.cache.size}**`
    );
  }

  /* =========================
     SAY
  ========================= */

  if (command === "say") {
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

    const text = args.join(" ");

    if (!text) {
      return message.reply(
        "❌ Usage: `--say message`"
      );
    }

    await message.delete().catch(() => {});

    return message.channel.send(text);
  }

  /* =========================
     TICKET SETUP
  ========================= */

  if (command === "ticketsetup") {
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

    const category = message.mentions.channels.first();

    if (
      !category ||
      category.type !== ChannelType.GuildCategory
    ) {
      return message.reply(
        "❌ Usage: `--ticketsetup #category`\n\nYou must mention a **category**, not a normal text channel."
      );
    }

    data.ticketCategories[message.guild.id] = category.id;
    saveData();

    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("create_ticket")
        .setLabel("Create Ticket")
        .setEmoji("🎫")
        .setStyle(ButtonStyle.Primary)
    );

    await message.channel.send(
      `🎫 **FLEASION SUPPORT**

Need help? Click the button below to create a private ticket.

Only you can see your ticket.`,
    );

    await message.channel.send({
      components: [button]
    });

    return message.reply(
      `✅ Ticket system configured using ${category}.`
    );
  }

  /* =========================
     GIVEAWAY
  ========================= */

  if (command === "giveaway") {
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

    const duration = parseDuration(args[0]);
    const winners = Number(args[1]);
    const prize = args.slice(2).join(" ");

    if (!duration || !winners || !prize) {
      return message.reply(
        "❌ Usage: `--giveaway 10m 1 Prize`"
      );
    }

    if (duration < 10000) {
      return message.reply(
        "❌ Giveaway duration must be at least 10 seconds."
      );
    }

    const giveawayId =
      `${message.guild.id}-${Date.now()}`;

    giveaways.set(giveawayId, {
      channelId: message.channel.id,
      entrants: new Set(),
      winners,
      prize
    });

    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`giveaway_${giveawayId}`)
        .setLabel("Enter Giveaway")
        .setEmoji("🎉")
        .setStyle(ButtonStyle.Success)
    );

    const giveawayMessage =
      await message.channel.send({
        content:
`🎉 **GIVEAWAY**

Prize: **${prize}**
Winners: **${winners}**
Ends: <t:${Math.floor((Date.now() + duration) / 1000)}:R>

Click the button below to enter!`,
        components: [button]
      });

    setTimeout(async () => {
      const giveaway = giveaways.get(giveawayId);

      if (!giveaway) return;

      giveaways.delete(giveawayId);

      const entrants = [...giveaway.entrants];

      if (entrants.length === 0) {
        return giveawayMessage.edit({
          content:
`🎉 **GIVEAWAY ENDED**

Prize: **${prize}**

❌ Nobody entered.`,
          components: []
        }).catch(() => {});
      }

      const selected = [];

      while (
        selected.length < Math.min(winners, entrants.length)
      ) {
        const random =
          entrants[Math.floor(Math.random() * entrants.length)];

        if (!selected.includes(random)) {
          selected.push(random);
        }
      }

      const winnerText =
        selected.map(id => `<@${id}>`).join(", ");

      await giveawayMessage.edit({
        content:
`🎉 **GIVEAWAY ENDED**

Prize: **${prize}**

🏆 Winner${selected.length > 1 ? "s" : ""}: ${winnerText}`,
        components: []
      }).catch(() => {});

      message.channel.send(
        `🎉 Congratulations ${winnerText}! You won **${prize}**!`
      ).catch(() => {});
    }, duration);

    return;
  }
});

/* =========================
   BUTTON HANDLER
========================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  /* =========================
     CREATE TICKET
  ========================= */

  if (interaction.customId === "create_ticket") {
    const guild = interaction.guild;

    const categoryId =
      data.ticketCategories[guild.id];

    if (!categoryId) {
      return interaction.reply({
        content:
          "❌ Tickets haven't been configured yet.",
        ephemeral: true
      });
    }

    const existing =
      guild.channels.cache.find(
        channel =>
          channel.name ===
          `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}`
      );

    if (existing) {
      return interaction.reply({
        content:
          `❌ You already have a ticket: ${existing}`,
        ephemeral: true
      });
    }

    const safeName =
      interaction.user.username
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 20);

    const ticket =
      await guild.channels.create({
        name: `ticket-${safeName}`,
        type: ChannelType.GuildText,
        parent: categoryId,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory
            ]
          }
        ]
      });

    const closeButton =
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("close_ticket")
          .setLabel("Close Ticket")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger)
      );

    await ticket.send({
      content:
`🎫 **TICKET CREATED**

Welcome ${interaction.user}!

Explain your issue and someone will help you.

Click **Close Ticket** when you're finished.`,
      components: [closeButton]
    });

    return interaction.reply({
      content: `✅ Ticket created: ${ticket}`,
      ephemeral: true
    });
  }

  /* =========================
     CLOSE TICKET
  ========================= */

  if (interaction.customId === "close_ticket") {
    await interaction.reply(
      "🔒 Closing ticket in 5 seconds..."
    );

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 5000);

    return;
  }

  /* =========================
     GIVEAWAY BUTTON
  ========================= */

  if (
    interaction.customId.startsWith("giveaway_")
  ) {
    const giveawayId =
      interaction.customId.replace("giveaway_", "");

    const giveaway =
      giveaways.get(giveawayId);

    if (!giveaway) {
      return interaction.reply({
        content:
          "❌ This giveaway has already ended.",
        ephemeral: true
      });
    }

    if (
      giveaway.entrants.has(interaction.user.id)
    ) {
      return interaction.reply({
        content:
          "❌ You're already entered.",
        ephemeral: true
      });
    }

    giveaway.entrants.add(interaction.user.id);

    return interaction.reply({
      content:
        "✅ You entered the giveaway! Good luck 🍀",
      ephemeral: true
    });
  }
});

/* =========================
   LOGIN
========================= */

if (!process.env.DISCORD_TOKEN) {
  console.error(
    "❌ DISCORD_TOKEN is missing from Railway environment variables."
  );
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
```
