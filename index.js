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

// ============================================================
// FLEASION BOT — PRLNGZZ DOG
// ============================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const prefix = "--";

// ============================================================
// SETTINGS
// ============================================================

const SETTINGS = {
  // AUTOMOD
  automod: true,
  blockInvites: true,
  blockLinks: false,
  maxMentions: 5,
  maxCapsPercent: 75,

  // ANTI-SPAM
  antiSpam: true,
  spamMessages: 8,
  spamWindow: 6000,
  spamTimeout: 15000,

  // ANTI-RAID
  antiRaid: true,
  raidJoinAmount: 5,
  raidJoinWindow: 10000,

  // BLOCKED WORDS
  blockedWords: [
    "nigger",
    "nigga",
    "faggot",
    "retard"
  ]
};

// ============================================================
// DATA STORAGE
// ============================================================

const DATA_FILE = "./fleasion-data.json";

let data = {
  warnings: {},
  welcomeChannels: {},
  ticketCategories: {},
  raidMode: {}
};

if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );
  } catch {
    console.log("Could not read data file. Creating new data.");
  }
}

function saveData() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(data, null, 2)
    );
  } catch (error) {
    console.log("Data save error:", error.message);
  }
}

// ============================================================
// MEMORY
// ============================================================

const spamTracker = new Map();
const raidTracker = new Map();
const giveaways = new Map();

// ============================================================
// HELPERS
// ============================================================

function getTarget(message, args) {
  return (
    message.mentions.members.first() ||
    message.guild.members.cache.get(args[0])
  );
}

function hasPermission(message, permission) {
  return message.member.permissions.has(permission);
}

function isStaff(member) {
  return member.permissions.has(
    PermissionsBitField.Flags.ManageMessages
  );
}

function getWarnings(guildId, userId) {
  if (!data.warnings[guildId]) {
    data.warnings[guildId] = {};
  }

  if (!data.warnings[guildId][userId]) {
    data.warnings[guildId][userId] = [];
  }

  return data.warnings[guildId][userId];
}

function durationToMs(text) {
  if (!text) return null;

  const match = text.match(/^(\d+)(s|m|h|d)$/i);

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

function cleanText(text) {
  return text
    .replace(/@everyone/g, "@\u200beveryone")
    .replace(/@here/g, "@\u200bhere");
}

// ============================================================
// READY
// ============================================================

client.once("ready", () => {
  console.log("=================================");
  console.log(`Prlngzz Dog is ONLINE`);
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Servers: ${client.guilds.cache.size}`);
  console.log("=================================");
});

// ============================================================
// MEMBER JOIN
// ============================================================

client.on("guildMemberAdd", async (member) => {
  const guildId = member.guild.id;

  // ==========================================================
  // ANTI-RAID
  // ==========================================================

  if (SETTINGS.antiRaid) {
    const now = Date.now();

    if (!raidTracker.has(guildId)) {
      raidTracker.set(guildId, []);
    }

    const joins = raidTracker.get(guildId);

    joins.push(now);

    while (
      joins.length &&
      now - joins[0] > SETTINGS.raidJoinWindow
    ) {
      joins.shift();
    }

    if (joins.length >= SETTINGS.raidJoinAmount) {
      if (!data.raidMode[guildId]) {
        data.raidMode[guildId] = true;
        saveData();

        console.log(
          `[ANTI-RAID] Raid detected in ${member.guild.name}`
        );

        try {
          const owner =
            await client.users.fetch(
              member.guild.ownerId
            );

          await owner.send(
            `🚨 ANTI-RAID ALERT\n\n` +
            `Possible raid detected in **${member.guild.name}**.\n` +
            `${joins.length} members joined within ${SETTINGS.raidJoinWindow / 1000} seconds.\n\n` +
            `No members were automatically kicked.`
          );
        } catch {}

        setTimeout(() => {
          data.raidMode[guildId] = false;
          saveData();
        }, 60000);
      }
    }
  }

  // ==========================================================
  // WELCOME
  // ==========================================================

  const channelId =
    data.welcomeChannels[guildId];

  if (!channelId) return;

  const channel =
    member.guild.channels.cache.get(channelId);

  if (!channel) return;

  try {
    await channel.send(
      `👋 welcome **${cleanText(member.user.username)}** to **${member.guild.name}**!`
    );
  } catch {}
});

// ============================================================
// MESSAGE CREATE
// ============================================================

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const content = message.content;
  const lower = content.toLowerCase();

  // ==========================================================
  // AUTOMOD
  // ==========================================================

  if (
    SETTINGS.automod &&
    !content.startsWith(prefix) &&
    !isStaff(message.member)
  ) {
    let violation = false;
    let reason = "";

    // BLOCKED WORDS
    for (const word of SETTINGS.blockedWords) {
      if (lower.includes(word.toLowerCase())) {
        violation = true;
        reason = "blocked word";
        break;
      }
    }

    // DISCORD INVITES
    if (
      SETTINGS.blockInvites &&
      /(discord\.gg|discord\.com\/invite\/)/i.test(content)
    ) {
      violation = true;
      reason = "discord invite";
    }

    // LINKS
    if (
      SETTINGS.blockLinks &&
      /(https?:\/\/|www\.)/i.test(content)
    ) {
      violation = true;
      reason = "link";
    }

    // MENTION SPAM
    if (
      message.mentions.users.size >=
      SETTINGS.maxMentions
    ) {
      violation = true;
      reason = "mention spam";
    }

    // CAPS SPAM
    const letters =
      content.replace(/[^a-zA-Z]/g, "");

    if (letters.length >= 8) {
      const uppercase =
        letters.replace(/[^A-Z]/g, "").length;

      const percentage =
        (uppercase / letters.length) * 100;

      if (
        percentage >=
        SETTINGS.maxCapsPercent
      ) {
        violation = true;
        reason = "excessive caps";
      }
    }

    if (violation) {
      try {
        await message.delete();
      } catch {}

      try {
        const warning =
          await message.channel.send(
            `⚠️ ${message.author}, your message was removed for **${reason}**.`
          );

        setTimeout(() => {
          warning.delete().catch(() => {});
        }, 4000);
      } catch {}

      return;
    }
  }

  // ==========================================================
  // ANTI-SPAM
  // ==========================================================

  if (
    SETTINGS.antiSpam &&
    !content.startsWith(prefix) &&
    !isStaff(message.member)
  ) {
    const key =
      `${message.guild.id}-${message.author.id}`;

    const now = Date.now();

    if (!spamTracker.has(key)) {
      spamTracker.set(key, []);
    }

    const messages =
      spamTracker.get(key);

    messages.push(now);

    while (
      messages.length &&
      now - messages[0] >
        SETTINGS.spamWindow
    ) {
      messages.shift();
    }

    if (
      messages.length >=
      SETTINGS.spamMessages
    ) {
      spamTracker.delete(key);

      try {
        await message.member.timeout(
          SETTINGS.spamTimeout,
          "Fleasion Anti-Spam"
        );

        await message.channel.send(
          `🚫 **${message.author.tag}** was temporarily muted for spam.`
        );
      } catch (error) {
        console.log(
          "Anti-spam error:",
          error.message
        );
      }

      return;
    }
  }

  // ==========================================================
  // PREFIX
  // ==========================================================

  if (!content.startsWith(prefix)) return;

  const args = content
    .slice(prefix.length)
    .trim()
    .split(/\s+/);

  const command =
    args.shift()?.toLowerCase();

  if (!command) return;

  // ==========================================================
  // SETUP
  // ==========================================================

  if (command === "setup") {
    return message.channel.send(
`⚙️ **FLEASION SETUP**

━━━━━━━━━━━━━━━━━━━━

👋 **WELCOME**

First create a channel like:
\`#welcome\`

Then run:
\`--setwelcome #welcome\`

Whenever someone joins, Fleasion will send a welcome message there.

━━━━━━━━━━━━━━━━━━━━

🎫 **TICKETS**

1. Create a category called something like:
\`🎫 Tickets\`

2. Run:
\`--ticketsetup #tickets\`

3. Fleasion will send a ticket panel.

4. Members click **Create Ticket**.

5. A private ticket channel gets created automatically.

6. Members click **Close Ticket** when they're done.

━━━━━━━━━━━━━━━━━━━━

🎉 **GIVEAWAYS**

Use:
\`--giveaway 1h 1 RIVALS Skin\`

Format:
\`--giveaway [duration] [winners] [prize]\`

Examples:

\`--giveaway 10m 1 500 Robux\`

\`--giveaway 1h 2 RIVALS Skin\`

\`--giveaway 1d 1 Skin Case\`

Time formats:
\`10s\` = 10 seconds
\`10m\` = 10 minutes
\`1h\` = 1 hour
\`1d\` = 1 day

━━━━━━━━━━━━━━━━━━━━

🛡️ **PROTECTION**

Automod: ✅ ON
Anti-spam: ✅ ON
Anti-raid: ✅ ON

Anti-spam:
**8 messages within 6 seconds**
→ **15 second timeout**

Anti-raid:
**5 joins within 10 seconds**
→ owner gets an alert

━━━━━━━━━━━━━━━━━━━━

🛠️ **MODERATION**

\`--warn @user reason\`
\`--warnings @user\`
\`--clearwarnings @user\`

\`--mute @user 10s\`
\`--unmute @user\`

\`--kick @user\`
\`--ban @user\`
\`--unban USER_ID\`

\`--clear 20\`
\`--purge 20\`

\`--lock\`
\`--unlock\`
\`--slowmode 10\`

━━━━━━━━━━━━━━━━━━━━

👤 **INFO**

\`--userinfo @user\`
\`--serverinfo\`
\`--nick @user name\`

━━━━━━━━━━━━━━━━━━━━

💬 **OTHER**

\`--say message\`
\`--help\`

━━━━━━━━━━━━━━━━━━━━

💡 **TIP**

You can always run:
\`--setup\`

to see this setup guide again.`
    );
  }

  // ==========================================================
  // WARN
  // ==========================================================

  if (command === "warn") {
    if (
      !hasPermission(
        message,
        PermissionsBitField.Flags.ModerateMembers
      )
    ) {
      return message.reply(
        "you don't have permission to warn people 😭"
      );
    }

    const target =
      getTarget(message, args);

    if (!target) {
      return message.reply(
        "mention someone 💀"
      );
    }

    const reason =
      args.slice(1).join(" ") ||
      "No reason provided";

    const warnings =
      getWarnings(
        message.guild.id,
        target.id
      );

    warnings.push({
      reason,
      moderator: message.author.id,
      timestamp: Date.now()
    });

    saveData();

    return message.channel.send(
      `⚠️ **${target.user.tag}** has been warned.\n` +
      `Reason: **${reason}**\n` +
      `Warnings: **${warnings.length}**`
    );
  }

  // ==========================================================
  // WARNINGS
  // ==========================================================

  if (
    command === "warnings" ||
    command === "warns"
  ) {
    const target =
      getTarget(message, args) ||
      message.member;

    const warnings =
      getWarnings(
        message.guild.id,
        target.id
      );

    if (!warnings.length) {
      return message.reply(
        `✅ **${target.user.tag}** has no warnings.`
      );
    }

    let output =
      `⚠️ **Warnings for ${target.user.tag}**\n\n`;

    warnings.forEach(
      (warning, index) => {
        output +=
          `**${index + 1}.** ${warning.reason}\n`;
      }
    );

    return message.channel.send(
      output
    );
  }

  // ==========================================================
  // CLEAR WARNINGS
  // ==========================================================

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
      return message.reply(
        "you don't have permission to clear warnings 😭"
      );
    }

    const target =
      getTarget(message, args);

    if (!target) {
      return message.reply(
        "mention someone 💀"
      );
    }

    if (data.warnings[message.guild.id]) {
      delete data.warnings[
        message.guild.id
      ][target.id];
    }

    saveData();

    return message.channel.send(
      `🧹 cleared all warnings for **${target.user.tag}**`
    );
  }

  // ==========================================================
  // MUTE / TIMEOUT
  // ==========================================================

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
      return message.reply(
        "you don't have permission to mute people 😭"
      );
    }

    const target =
      getTarget(message, args);

    if (!target) {
      return message.reply(
        "mention someone 💀"
      );
    }

    const durationText =
      args[1];

    const duration =
      durationToMs(durationText);

    if (!duration) {
      return message.reply(
        "use something like `10s`, `5m`, `1h` or `1d`"
      );
    }

    if (
      duration >
      28 * 24 * 60 * 60 * 1000
    ) {
      return message.reply(
        "maximum timeout is 28 days 😭"
      );
    }

    try {
      await target.timeout(
        duration,
        `Muted by ${message.author.tag}`
      );

      return message.channel.send(
        `🔇 **${target.user.tag}** has been muted for **${durationText}**`
      );
    } catch {
      return message.reply(
        "i couldn't mute them. make sure my role is above theirs."
      );
    }
  }

  // ==========================================================
  // UNMUTE
  // ==========================================================

  if (command === "unmute") {
    if (
      !hasPermission(
        message,
        PermissionsBitField.Flags.ModerateMembers
      )
    ) {
      return message.reply(
        "you don't have permission to unmute people 😭"
      );
    }

    const target =
      getTarget(message, args);

    if (!target) {
      return message.reply(
        "mention someone 💀"
      );
    }

    try {
      await target.timeout(null);

      return message.channel.send(
        `🔊 **${target.user.tag}** has been unmuted.`
      );
    } catch {
      return message.reply(
        "i couldn't unmute them."
      );
    }
  }

  // ==========================================================
  // KICK
  // ==========================================================

  if (command === "kick") {
    if (
      !hasPermission(
        message,
        PermissionsBitField.Flags.KickMembers
      )
    ) {
      return message.reply(
        "you don't have permission to kick people 😭"
      );
    }

    const target =
      getTarget(message, args);

    if (!target) {
      return message.reply(
        "mention someone 💀"
      );
    }

    try {
      await target.kick(
        `Kicked by ${message.author.tag}`
      );

      return message.channel.send(
        `👢 **${target.user.tag}** has been kicked.`
      );
    } catch {
      return message.reply(
        "i couldn't kick them."
      );
    }
  }

  // ==========================================================
  // BAN
  // ==========================================================

  if (command === "ban") {
    if (
      !hasPermission(
        message,
        PermissionsBitField.Flags.BanMembers
      )
    ) {
      return message.reply(
        "you don't have permission to ban people 😭"
      );
    }

    const target =
      getTarget(message, args);

    if (!target) {
      return message.reply(
        "mention someone 💀"
      );
    }

    try {
      await target.ban({
        reason:
          `Banned by ${message.author.tag}`
      });

      return message.channel.send(
        `🔨 **${target.user.tag}** has been banned.`
      );
    } catch {
      return message.reply(
        "i couldn't ban them."
      );
    }
  }

  // ==========================================================
  // UNBAN
  // ==========================================================

  if (command === "unban") {
    if (
      !hasPermission(
        message,
        PermissionsBitField.Flags.BanMembers
      )
    ) {
      return message.reply(
        "you don't have permission to unban people 😭"
      );
    }

    const userId = args[0];

    if (!userId) {
      return message.reply(
        "give me the user's ID 💀"
      );
    }

    try {
      await message.guild.members.unban(
        userId
      );

      return message.channel.send(
        `🔓 user **${userId}** has been unbanned.`
      );
    } catch {
      return message.reply(
        "i couldn't unban that user."
      );
    }
  }

  // ==========================================================
  // CLEAR / PURGE
  // ==========================================================

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
        "you don't have permission to delete messages 😭"
      );
    }

    const amount =
      Number(args[0]);

    if (
      !amount ||
      amount < 1 ||
      amount > 100
    ) {
      return message.reply(
        "use a number between 1 and 100"
      );
    }

    try {
      await message.channel.bulkDelete(
        amount,
        true
      );

      const msg =
        await message.channel.send(
          `🧹 deleted **${amount}** messages`
        );

      setTimeout(() => {
        msg.delete().catch(() => {});
      }, 3000);
    } catch {
      return message.reply(
        "i couldn't delete those messages."
      );
    }
  }

  // ==========================================================
  // LOCK
  // ==========================================================

  if (command === "lock") {
    if (
      !hasPermission(
        message,
        PermissionsBitField.Flags.ManageChannels
      )
    ) {
      return message.reply(
        "you don't have permission to lock channels 😭"
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
        "🔒 channel locked."
      );
    } catch {
      return message.reply(
        "i couldn't lock this channel."
      );
    }
  }

  // ==========================================================
  // UNLOCK
  // ==========================================================

  if (command === "unlock") {
    if (
      !hasPermission(
        message,
        PermissionsBitField.Flags.ManageChannels
      )
    ) {
      return message.reply(
        "you don't have permission to unlock channels 😭"
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
        "🔓 channel unlocked."
      );
    } catch {
      return message.reply(
        "i couldn't unlock this channel."
      );
    }
  }

  // ==========================================================
  // SLOWMODE
  // ==========================================================

  if (command === "slowmode") {
    if (
      !hasPermission(
        message,
        PermissionsBitField.Flags.ManageChannels
      )
    ) {
      return message.reply(
        "you don't have permission to use slowmode 😭"
      );
    }

    const seconds =
      Number(args[0]);

    if (
      isNaN(seconds) ||
      seconds < 0 ||
      seconds > 21600
    ) {
      return message.reply(
        "use between 0 and 21600 seconds"
      );
    }

    try {
      await message.channel.setRateLimitPerUser(
        seconds
      );

      return message.channel.send(
        `🐌 slowmode set to **${seconds}s**`
      );
    } catch {
      return message.reply(
        "i couldn't change the slowmode."
      );
    }
  }

  // ==========================================================
  // NICK
  // ==========================================================

  if (command === "nick") {
    if (
      !hasPermission(
        message,
        PermissionsBitField.Flags.ManageNicknames
      )
    ) {
      return message.reply(
        "you don't have permission to change nicknames 😭"
      );
    }

    const target =
      getTarget(message, args);

    if (!target) {
      return message.reply(
        "mention someone 💀"
      );
    }

    const nickname =
      args.slice(1).join(" ") ||
      null;

    try {
      await target.setNickname(
        nickname
      );

      return message.channel.send(
        `✏️ nickname updated for **${target.user.tag}**`
      );
    } catch {
      return message.reply(
        "i couldn't change their nickname."
      );
    }
  }

  // ==========================================================
  // USERINFO
  // ==========================================================

  if (command === "userinfo") {
    const target =
      getTarget(message, args) ||
      message.member;

    return message.channel.send(
      `👤 **${target.user.tag}**\n` +
      `ID: ${target.id}\n` +
      `Joined: ${target.joinedAt?.toLocaleString() || "unknown"}`
    );
  }

  // ==========================================================
  // SERVERINFO
  // ==========================================================

  if (command === "serverinfo") {
    return message.channel.send(
      `🏠 **${message.guild.name}**\n` +
      `Members: ${message.guild.memberCount}\n` +
      `Server ID: ${message.guild.id}`
    );
  }

  // ==========================================================
  // SAY
  // ==========================================================

  if (command === "say") {
    if (
      !hasPermission(
        message,
        PermissionsBitField.Flags.ManageMessages
      )
    ) {
      return message.reply(
        "you don't have permission to use this 😭"
      );
    }

    const text =
      args.join(" ");

    if (!text) {
      return message.reply(
        "tell me what to say 💀"
      );
    }

    await message.delete().catch(() => {});

    return message.channel.send(
      cleanText(text)
    );
  }

  // ==========================================================
  // SET WELCOME
  // ==========================================================

  if (command === "setwelcome") {
    if (
      !hasPermission(
        message,
        PermissionsBitField.Flags.ManageGuild
      )
    ) {
      return message.reply(
        "you don't have permission to configure welcome messages 😭"
      );
    }

    const channel =
      message.mentions.channels.first();

    if (!channel) {
      return message.reply(
        "use `--setwelcome #welcome`"
      );
    }

    data.welcomeChannels[
      message.guild.id
    ] = channel.id;

    saveData();

    return message.channel.send(
      `👋 welcome channel set to ${channel}`
    );
  }

  // ==========================================================
  // TICKET SETUP
  // ==========================================================

  if (command === "ticketsetup") {
    if (
      !hasPermission(
        message,
        PermissionsBitField.Flags.ManageChannels
      )
    ) {
      return message.reply(
        "you don't have permission to setup tickets 😭"
      );
    }

    const category =
      message.mentions.channels.first();

    if (!category) {
      return message.reply(
        "use `--ticketsetup #tickets`"
      );
    }

    if (
      category.type !==
      ChannelType.GuildCategory
    ) {
      return message.reply(
        "that needs to be a category 💀"
      );
    }

    data.ticketCategories[
      message.guild.id
    ] = category.id;

    saveData();

    const button =
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

    await message.channel.send({
      content:
        "🎫 **FLEASION TICKETS**\n\n" +
        "Need help or want to order something?\n" +
        "Click the button below to create a private ticket.",
      components: [button]
    });

    return;
  }

  // ==========================================================
  // GIVEAWAY
  // ==========================================================

  if (command === "giveaway") {
    if (
      !hasPermission(
        message,
        PermissionsBitField.Flags.ManageGuild
      )
    ) {
      return message.reply(
        "you don't have permission to start giveaways 😭"
      );
    }

    const durationText =
      args[0];

    const winners =
      Number(args[1]);

    const prize =
      args.slice(2).join(" ");

    const duration =
      durationToMs(
        durationText
      );

    if (!duration) {
      return message.reply(
        "use something like `--giveaway 1h 1 RIVALS Skin`"
      );
    }

    if (
      !winners ||
      winners < 1
    ) {
      return message.reply(
        "give me the number of winners 💀"
      );
    }

    if (!prize) {
      return message.reply(
        "give me a prize 💀"
      );
    }

    const giveawayId =
      `${message.guild.id}-${Date.now()}`;

    const endTime =
      Date.now() + duration;

    const button =
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `giveaway_${giveawayId}`
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
      await message.channel.send({
        content:
          `🎉 **GIVEAWAY** 🎉\n\n` +
          `Prize: **${cleanText(prize)}**\n` +
          `Winners: **${winners}**\n` +
          `Ends: <t:${Math.floor(
            endTime / 1000
          )}:R>\n\n` +
          `Click the button below to enter!`,
        components: [button]
      });

    giveaways.set(
      giveawayId,
      {
        guildId:
          message.guild.id,

        channelId:
          message.channel.id,

        messageId:
          giveawayMessage.id,

        prize,
        winners,

        entries:
          new Set(),

        endTime
      }
    );

    setTimeout(
      () => endGiveaway(
        giveawayId
      ),
      duration
    );

    return;
  }

  // ==========================================================
  // HELP
  // ==========================================================

  if (command === "help") {
    return message.channel.send(
`**FLEASION BOT**

🛡️ MODERATION
\`--ban @user\`
\`--unban USER_ID\`
\`--kick @user\`
\`--mute @user 10s\`
\`--unmute @user\`
\`--warn @user reason\`
\`--warnings @user\`
\`--clearwarnings @user\`
\`--clear 20\`
\`--purge 20\`

🔒 CHANNELS
\`--lock\`
\`--unlock\`
\`--slowmode 10\`

👋 WELCOME
\`--setwelcome #channel\`

🎫 TICKETS
\`--ticketsetup #category\`

🎉 GIVEAWAYS
\`--giveaway 1h 1 Prize\`

👤 INFO
\`--nick @user name\`
\`--userinfo @user\`
\`--serverinfo\`

💬 OTHER
\`--say message\`

⚙️ SETUP
\`--setup\`

🛡️ PROTECTION
Automod: ON
Anti-spam: 8 / 6s
Anti-raid: ON`
    );
  }
});

// ============================================================
// BUTTON INTERACTIONS
// ============================================================

client.on(
  "interactionCreate",
  async (interaction) => {

    if (!interaction.isButton()) return;

    // ========================================================
    // CREATE TICKET
    // ========================================================

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
            "ticket system hasn't been configured yet 😭",
          ephemeral: true
        });
      }

      const existing =
        guild.channels.cache.find(
          channel =>
            channel.name ===
              `ticket-${interaction.user.username.toLowerCase()}` &&
            channel.parentId ===
              categoryId
        );

      if (existing) {
        return interaction.reply({
          content:
            `you already have a ticket: ${existing}`,
          ephemeral: true
        });
      }

      try {
        const channel =
          await guild.channels.create({
            name:
              `ticket-${interaction.user.username}`
                .toLowerCase()
                .replace(
                  /[^a-z0-9-]/g,
                  ""
                )
                .slice(0, 90),

            type:
              ChannelType.GuildText,

            parent:
              categoryId,

            permissionOverwrites: [
              {
                id:
                  guild.roles.everyone.id,

                deny: [
                  PermissionsBitField.Flags
                    .ViewChannel
                ]
              },
              {
                id:
                  interaction.user.id,

                allow: [
                  PermissionsBitField.Flags
                    .ViewChannel,

                  PermissionsBitField.Flags
                    .SendMessages,

                  PermissionsBitField.Flags
                    .ReadMessageHistory
                ]
              }
            ]
          });

        const closeButton =
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

        await channel.send({
          content:
            `🎫 **Ticket created!**\n\n` +
            `${interaction.user}, tell us what you need help with.\n\n` +
            `A staff member will help you soon.`,
          components: [
            closeButton
          ]
        });

        return interaction.reply({
          content:
            `🎫 your ticket has been created: ${channel}`,
          ephemeral: true
        });

      } catch (error) {
        console.log(
          "Ticket error:",
          error
        );

        return interaction.reply({
          content:
            "i couldn't create the ticket. check my permissions 😭",
          ephemeral: true
        });
      }
    }

    // ========================================================
    // CLOSE TICKET
    // ========================================================

    if (
      interaction.customId ===
      "close_ticket"
    ) {
      if (
        !interaction.channel.name.startsWith(
          "ticket-"
        )
      ) {
        return interaction.reply({
          content:
            "this isn't a ticket.",
          ephemeral: true
        });
      }

      await interaction.reply(
        "🔒 closing ticket in 5 seconds..."
      );

      setTimeout(() => {
        interaction.channel
          .delete()
          .catch(() => {});
      }, 5000);

      return;
    }

    // ========================================================
    // GIVEAWAY
    // ========================================================

    if (
      interaction.customId.startsWith(
        "giveaway_"
      )
    ) {
      const giveawayId =
        interaction.customId.replace(
          "giveaway_",
          ""
        );

      const giveaway =
        giveaways.get(
          giveawayId
        );

      if (!giveaway) {
        return interaction.reply({
          content:
            "this giveaway has already ended 😭",
          ephemeral: true
        });
      }

      if (
        giveaway.entries.has(
          interaction.user.id
        )
      ) {
        return interaction.reply({
          content:
            "you're already entered 😭",
          ephemeral: true
        });
      }

      giveaway.entries.add(
        interaction.user.id
      );

      return interaction.reply({
        content:
          "🎉 you're entered into the giveaway!",
        ephemeral: true
      });
    }
  }
);

// ============================================================
// END GIVEAWAY
// ============================================================

async function endGiveaway(id) {
  const giveaway =
    giveaways.get(id);

  if (!giveaway) return;

  const guild =
    client.guilds.cache.get(
      giveaway.guildId
    );

  if (!guild) return;

  const channel =
    guild.channels.cache.get(
      giveaway.channelId
    );

  if (!channel) return;

  const entries =
    Array.from(
      giveaway.entries
    );

  if (!entries.length) {
    await channel.send(
      `🎉 **GIVEAWAY ENDED!**\n\n` +
      `Prize: **${cleanText(
        giveaway.prize
      )}**\n` +
      `Nobody entered 😭`
    ).catch(() => {});

    giveaways.delete(id);

    return;
  }

  const winners = [];

  const amount =
    Math.min(
      giveaway.winners,
      entries.length
    );

  while (
    winners.length < amount
  ) {
    const random =
      entries[
        Math.floor(
          Math.random() *
          entries.length
        )
      ];

    if (
      !winners.includes(
        random
      )
    ) {
      winners.push(random);
    }
  }

  const mentions =
    winners
      .map(
        id => `<@${id}>`
      )
      .join(", ");

  await channel.send(
    `🎉 **GIVEAWAY ENDED!** 🎉\n\n` +
    `Prize: **${cleanText(
      giveaway.prize
    )}**\n` +
    `Winner${winners.length === 1 ? "" : "s"}: ${mentions}`
  ).catch(() => {});

  giveaways.delete(id);
}

// ============================================================
// ERRORS
// ============================================================

process.on(
  "unhandledRejection",
  error => {
    console.error(
      "Unhandled rejection:",
      error
    );
  }
);

process.on(
  "uncaughtException",
  error => {
    console.error(
      "Uncaught exception:",
      error
    );
  }
);

// ============================================================
// LOGIN
// ============================================================

client.login(
  process.env.DISCORD_TOKEN
);
