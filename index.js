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
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
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
  console.log("PRLNGZZ DOG online as " + client.user.tag);

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

  if (recent.length >= 5 && !data.raidMode[guildId]) {
    data.raidMode[guildId] = true;
    saveData();

    try {
      const owner = await member.guild.fetchOwner();

      await owner.send(
        "🚨 RAID ALERT\n\n" +
        "5 or more members joined within 10 seconds in " +
        member.guild.name +
        ".\n\nRaid mode activated for 60 seconds."
      );
    } catch (error) {
      console.log("Could not DM server owner.");
    }

    setTimeout(function () {
      data.raidMode[guildId] = false;
      saveData();
    }, 60000);
  }

  const welcomeChannelId = data.welcomeChannels[guildId];

  if (!welcomeChannelId) return;

  const channel = member.guild.channels.cache.get(
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

client.on("messageCreate", async function (message) {
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

    const messages = spamTracker.get(userId);

    messages.push(Date.now());

    const recent = messages.filter(function (time) {
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
        console.log("Could not timeout spammer.");
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

  const args = content
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
      "`--nick @user NewName`\n\n" +

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
      "`--nick @user Name`\n\n" +

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

    data.welcomeChannels[message.guild.id] =
      channel.id;

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

    const member = getMember(
      message,
      args[0]
    );

    if (!member) {
      return message.reply(
        "❌ Usage: `--warn @user reason`"
      );
    }

    const reason =
      args.slice(1).join(" ") ||
      "No reason provided";

    const guildId = message.guild.id;

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
    const member = getMember(
      message,
      args[0]
    );

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

    warnings.forEach(function (warning, index) {
      text +=
        "**" +
        (index + 1) +
        ".** " +
        warning.reason +
        "\n";
    });

    return message.reply(text);
  }

  /* =========================
     CLEAR WARNINGS
  ========================= */

  if (
    cmd === "clearwarnings" ||
    cmd === "unwarn"
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

    const member = getMember(
      message,
      args[0]
    );

    if (!member) {
      return message.reply(
        "❌ Usage: `--clearwarnings @user`"
      );
    }

    if (data.warnings[message.guild.id]) {
      delete data.warnings[message.guild.id][
        member.id
      ];

      saveData();
    }

    return message.reply(
      "✅ Cleared all warnings for " +
        member.toString() +
        "."
    );
  }

  /* =========================
     BAN
  ========================= */

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

    const member = getMember(
      message,
      args[0]
    );

    if (!member) {
      return message.reply(
        "❌ Usage: `--ban @user`"
      );
    }

    if (!member.bannable) {
      return message.reply(
        "❌ I can't ban that member."
      );
    }

    const reason =
      args.slice(1).join(" ") ||
      "No reason provided";

    await member.ban({
      reason: reason
    });

    return message.reply(
      "🔨 Banned **" +
        member.user.tag +
        "**."
    );
  }

  /* =========================
     UNBAN
  ========================= */

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
        "❌ Usage: `--unban USER_ID`"
      );
    }

    try {
      await message.guild.members.unban(
        userId
      );

      return message.reply(
        "✅ Unbanned `" +
          userId +
          "`."
      );
    } catch (error) {
      return message.reply(
        "❌ Could not unban that user."
      );
    }
  }

  /* =========================
     KICK
  ========================= */

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

    const member = getMember(
      message,
      args[0]
    );

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

    await member.kick(
      args.slice(1).join(" ") ||
        "No reason provided"
    );

    return message.reply(
      "👢 Kicked **" +
        member.user.tag +
        "**."
    );
  }

  /* =========================
     MUTE / TIMEOUT
  ========================= */

  if (
    cmd === "mute" ||
    cmd === "timeout"
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

    const member = getMember(
      message,
      args[0]
    );

    if (!member) {
      return message.reply(
        "❌ Usage: `--mute @user 10m`"
      );
    }

    let duration = 10 * 60 * 1000;

    if (args[1]) {
      const parsed = parseDuration(
        args[1]
      );

      if (parsed) {
        duration = parsed;
      }
    }

    const maximum =
      28 * 24 * 60 * 60 * 1000;

    if (duration > maximum) {
      return message.reply(
        "❌ Maximum timeout is 28 days."
      );
    }

    await member.timeout(
      duration,
      "Moderator timeout"
    );

    return message.reply(
      "🔇 " +
        member.toString() +
        " timed out for **" +
        durationText(duration) +
        "**."
    );
  }

  /* =========================
     UNMUTE
  ========================= */

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

    const member = getMember(
      message,
      args[0]
    );

    if (!member) {
      return message.reply(
        "❌ Usage: `--unmute @user`"
      );
    }

    await member.timeout(null);

    return message.reply(
      "🔊 " +
        member.toString() +
        " has been unmuted."
    );
  }

  /* =========================
     CLEAR / PURGE
  ========================= */

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

    const amount = Number(args[0]);

    if (
      !Number.isInteger(amount) ||
      amount < 1 ||
      amount > 100
    ) {
      return message.reply(
        "❌ Use a number between 1 and 100."
      );
    }

    const deleted =
      await message.channel.bulkDelete(
        amount,
        true
      );

    return message.channel.send(
      "🧹 Deleted **" +
        deleted.size +
        "** messages."
    );
  }

  /* =========================
     LOCK
  ========================= */

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
    );

    return message.reply(
      "🔒 Channel locked."
    );
  }

  /* =========================
     UNLOCK
  ========================= */

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
    );

    return message.reply(
      "🔓 Channel unlocked."
    );
  }

  /* =========================
     SLOWMODE
  ========================= */

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

    const seconds = Number(args[0]);

    if (
      !Number.isInteger(seconds) ||
      seconds < 0 ||
      seconds > 21600
    ) {
      return message.reply(
        "❌ Use a number between 0 and 21600."
      );
    }

    await message.channel.setRateLimitPerUser(
      seconds
    );

    return message.reply(
      "🐌 Slowmode set to **" +
        seconds +
        " seconds**."
    );
  }

  /* =========================
     NICK
  ========================= */

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

    const member = getMember(
      message,
      args[0]
    );

    if (!member) {
      return message.reply(
        "❌ Usage: `--nick @user NewName`"
      );
    }

    const nickname =
      args.slice(1).join(" ");

    if (!nickname) {
      return message.reply(
        "❌ Enter a nickname."
      );
    }

    await member.setNickname(nickname);

    return message.reply(
      "✅ Nickname changed to **" +
        nickname +
        "**."
    );
  }

  /* =========================
     USERINFO
  ========================= */

  if (cmd === "userinfo") {
    const member =
      getMember(message, args[0]) ||
      message.member;

    return message.reply(
      "👤 **USER INFO**\n\n" +
      "Username: **" +
      member.user.tag +
      "**\n" +
      "ID: `" +
      member.id +
      "`\n" +
      "Joined: <t:" +
      Math.floor(member.joinedTimestamp / 1000) +
      ":R>"
    );
  }

  /* =========================
     SERVERINFO
  ========================= */

  if (cmd === "serverinfo") {
    return message.reply(
      "🏠 **SERVER INFO**\n\n" +
      "Name: **" +
      message.guild.name +
      "**\n" +
      "ID: `" +
      message.guild.id +
      "`\n" +
      "Members: **" +
      message.guild.memberCount +
      "**\n" +
      "Channels: **" +
      message.guild.channels.cache.size +
      "**\n" +
      "Roles: **" +
      message.guild.roles.cache.size +
      "**"
    );
  }

  /* =========================
     SAY
  ========================= */

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
      args.join(" ");

    if (!text) {
      return message.reply(
        "❌ Usage: `--say message`"
      );
    }

    await message.delete().catch(
      function () {}
    );

    return message.channel.send(text);
  }

  /* =========================
     TICKET SETUP
  ========================= */

  if (cmd === "ticketsetup") {
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

    const category =
      message.mentions.channels.first();

    if (
      !category ||
      category.type !==
        ChannelType.GuildCategory
    ) {
      return message.reply(
        "❌ Usage: `--ticketsetup #category`\n" +
        "You must mention a category."
      );
    }

    data.ticketCategories[
      message.guild.id
    ] = category.id;

    saveData();

    const row =
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("create_ticket")
          .setLabel("Create Ticket")
          .setEmoji("🎫")
          .setStyle(
            ButtonStyle.Primary
          )
      );

    await message.channel.send({
      content:
        "🎫 **PRLNGZZ DOG SUPPORT**\n\n" +
        "Need help? Click the button below to create a private ticket.",
      components: [row]
    });

    return message.reply(
      "✅ Ticket system configured."
    );
  }

  /* =========================
     GIVEAWAY
  ========================= */

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
      !winners ||
      !prize
    ) {
      return message.reply(
        "❌ Usage: `--giveaway 10m 1 Prize`"
      );
    }

    const id =
      message.guild.id +
      "-" +
      Date.now();

    giveaways.set(id, {
      channelId: message.channel.id,
      entrants: new Set(),
      winners: winners,
      prize: prize
    });

    const row =
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(
            "giveaway_" + id
          )
          .setLabel("Enter Giveaway")
          .setEmoji("🎉")
          .setStyle(
            ButtonStyle.Success
          )
      );

    const giveawayMessage =
      await message.channel.send({
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
            (Date.now() + duration) / 1000
          ) +
          ":R>\n\n" +
          "Click the button below to enter!",
        components: [row]
      });

    setTimeout(async function () {
      const giveaway =
        giveaways.get(id);

      if (!giveaway) return;

      giveaways.delete(id);

      const entrants =
        Array.from(giveaway.entrants);

      if (entrants.length === 0) {
        await giveawayMessage.edit({
          content:
            "🎉 **GIVEAWAY ENDED**\n\n" +
            "Prize: **" +
            prize +
            "**\n\n" +
            "❌ Nobody entered.",
          components: []
        }).catch(function () {});

        return;
      }

      const selected = [];

      while (
        selected.length <
        Math.min(
          winners,
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
          !selected.includes(random)
        ) {
          selected.push(random);
        }
      }

      const winnerText =
        selected
          .map(function (id) {
            return "<@" + id + ">";
          })
          .join(", ");

      await giveawayMessage.edit({
        content:
          "🎉 **GIVEAWAY ENDED**\n\n" +
          "Prize: **" +
          prize +
          "**\n\n" +
          "🏆 Winner(s): " +
          winnerText,
        components: []
      }).catch(function () {});

      message.channel.send(
        "🎉 Congratulations " +
          winnerText +
          "! You won **" +
          prize +
          "**!"
      ).catch(function () {});
    }, duration);

    return;
  }
});

/* =========================
   BUTTONS
========================= */

client.on(
  "interactionCreate",
  async function (interaction) {
    if (!interaction.isButton()) return;

    /* CREATE TICKET */

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
            "❌ Ticket system isn't configured.",
          ephemeral: true
        });
      }

      const safeName =
        interaction.user.username
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 20);

      const existing =
        guild.channels.cache.find(
          function (channel) {
            return (
              channel.name ===
              "ticket-" +
                safeName
            );
          }
        );

      if (existing) {
        return interaction.reply({
          content:
            "❌ You already have a ticket: " +
            existing.toString(),
          ephemeral: true
        });
      }

      const ticket =
        await guild.channels.create({
          name:
            "ticket-" +
            safeName,
          type: ChannelType.GuildText,
          parent: categoryId,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [
                PermissionsBitField.Flags.ViewChannel
              ]
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

      const row =
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(
              "close_ticket"
            )
            .setLabel("Close Ticket")
            .setEmoji("🔒")
            .setStyle(
              ButtonStyle.Danger
            )
        );

      await ticket.send({
        content:
          "🎫 **PRLNGZZ DOG TICKET**\n\n" +
          "Welcome " +
          interaction.user.toString() +
          "!\n\n" +
          "Explain your issue here.\n" +
          "Click **Close Ticket** when finished.",
        components: [row]
      });

      return interaction.reply({
        content:
          "✅ Ticket created: " +
          ticket.toString(),
        ephemeral: true
      });
    }

    /* CLOSE TICKET */

    if (
      interaction.customId ===
      "close_ticket"
    ) {
      await interaction.reply(
        "🔒 Closing ticket in 5 seconds..."
      );

      setTimeout(function () {
        interaction.channel
          .delete()
          .catch(function () {});
      }, 5000);

      return;
    }

    /* GIVEAWAY */

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

      return interaction.reply({
        content:
          "✅ You're entered! Good luck 🍀",
        ephemeral: true
      });
    }
  }
);

/* =========================
   LOGIN
========================= */

if (!process.env.DISCORD_TOKEN) {
  console.error(
    "❌ DISCORD_TOKEN is missing."
  );

  process.exit(1);
}

client.login(
  process.env.DISCORD_TOKEN
);
