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
  leaveChannels: {},
  ticketCategories: {},
  ticketCount: 30,
  maxOpenTickets: 5,
  statsChannels: {},
  completedOrders: {},
  afkUsers: {},
  raidMode: {}
};

if (fs.existsSync(DATA_FILE)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    data = { ...data, ...loaded };
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

async function deleteCommand(message) {
  await message.delete().catch(function () {});
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

function getMentionedMembers(message) {
  return Array.from(message.mentions.members.values());
}

function getNonMentionArgs(message, args) {
  const mentionIds = new Set(
    message.mentions.members.map(function (member) {
      return member.id;
    })
  );
  return args.filter(function (arg) {
    const match = arg.match(/^<@!?([0-9]+)>$/);
    return !match || !mentionIds.has(match[1]);
  });
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
  if (seconds < 60) return String(seconds) + "s";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return String(minutes) + "m";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return String(hours) + "h";
  return String(Math.floor(hours / 24)) + "d";
}

const spamTracker = new Map();
const raidTracker = new Map();
const giveaways = new Map();

async function updateStatsChannels(guild) {
  const guildId = guild.id;
  const statsConfig = data.statsChannels[guildId];
  if (!statsConfig) return;

  const channel = guild.channels.cache.get(statsConfig.channelId);
  if (!channel) return;

  const msg = await channel.messages.fetch(statsConfig.messageId).catch(() => null);
  if (!msg) return;

  const completed = (data.completedOrders && data.completedOrders[guildId] !== undefined)
    ? data.completedOrders[guildId]
    : 39;

  let activeTicketsCount = 0;
  const categoryId = data.ticketCategories[guildId];
  if (categoryId) {
    const cat = guild.channels.cache.get(categoryId);
    if (cat && cat.type === ChannelType.GuildCategory) {
      activeTicketsCount = guild.channels.cache.filter(
        c => c.parentId === categoryId && c.name.match(/^\d+-/)
      ).size;
    }
  }

  if (activeTicketsCount === 0) {
    activeTicketsCount = 30;
  }

  let creatorsCount = 0;
  const creatorRole = guild.roles.cache.find(r => r.name.toLowerCase() === "creator");
  if (creatorRole) {
    creatorsCount = creatorRole.members.size;
  }
  if (creatorsCount === 0) {
    creatorsCount = 4;
  }

  const content =
    `Completed Orders: ${completed}\n` +
    `Orders In Progress: ${activeTicketsCount}\n` +
    `Creators ${creatorsCount}`;

  await msg.edit(content).catch(() => {});
}

client.once("ready", function () {
  console.log("PRLNGZZ DOG online as " + client.user.tag);
  client.user.setActivity("--help");
});

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
          ".\n\n" +
          "Raid mode activated for 60 seconds."
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
  if (welcomeChannelId) {
    const channel = member.guild.channels.cache.get(welcomeChannelId);
    if (channel) {
      channel.send(
        "👋 Welcome " + member.user.toString() + " to **" + member.guild.name + "**!"
      ).catch(function () {});
    }
  }
});

client.on("guildMemberRemove", async function (member) {
  const guildId = member.guild.id;
  const leaveChannelId = data.leaveChannels[guildId];
  if (!leaveChannelId) return;

  const channel = member.guild.channels.cache.get(leaveChannelId);
  if (!channel) return;

  channel.send(
    member.user.toString() + " this not so nice person left us 😢"
  ).catch(function () {});
});

client.on("messageCreate", async function (message) {
  if (!message.guild) return;

  const guildId = message.guild.id;

  // AFK Ping check
  if (message.mentions.users.size > 0) {
    message.mentions.users.forEach(user => {
      const afkData = data.afkUsers[user.id];
      if (afkData) {
        if (Date.now() > afkData.expiresAt) {
          delete data.afkUsers[user.id];
          saveData();
        } else {
          const timeLeft = durationText(afkData.expiresAt - Date.now());
          message.reply(
            `${user.tag} is afk for ${timeLeft} more and wont get your ping until then.`
          ).catch(() => {});
        }
      }
    });
  }

  // Author AFK remove on speak
  if (data.afkUsers[message.author.id]) {
    delete data.afkUsers[message.author.id];
    saveData();
    message.reply("Welcome back! Your AFK status has been cleared.").catch(() => {});
  }

  if (message.author.bot) return;

  const content = message.content.trim();

  // Strip user/channel/role mentions so IDs don't trigger false 67/76 warnings
  const cleanContent = content
    .replace(/<@&?[0-9]+>/g, "")
    .replace(/<#[0-9]+>/g, "");

  const normalized = cleanContent.toLowerCase().replace(/[^a-z0-9]/g, "");
  const is67Trigger =
    /67|76/.test(normalized) ||
    /six\s*seven|seven\s*six/.test(cleanContent.toLowerCase());

  if (is67Trigger && !message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    if (!data.warnings[guildId]) {
      data.warnings[guildId] = {};
    }
    if (!data.warnings[guildId][message.author.id]) {
      data.warnings[guildId][message.author.id] = [];
    }
    data.warnings[guildId][message.author.id].push({
      reason: "67 makes me angy",
      moderator: client.user.id,
      timestamp: Date.now()
    });
    saveData();
    await deleteCommand(message);
    return message.channel.send(
      "⚠️ " + message.author.toString() + " was warned. **Reason:** 67 makes me angy"
    );
  }

  if (
    !message.member.permissions.has(PermissionsBitField.Flags.ManageMessages) &&
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
        await message.member.timeout(15000, "Anti-spam");
        await message.channel.send(
          "🛑 " + message.author.toString() + " has been timed out for **15 seconds** for spamming."
        );
      } catch (error) {
        console.log("Could not timeout spammer.");
      }
    }
  }

  if (
    !content.startsWith(PREFIX) &&
    !message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)
  ) {
    const inviteRegex = /(discord\.gg\/|discord\.com\/invite\/)/i;
    if (inviteRegex.test(content)) {
      try {
        await message.delete();
        await message.channel.send(
          "🚫 " + message.author.toString() + ", Discord invites are not allowed here."
        );
      } catch (error) {}
      return;
    }

    if (message.mentions.users.size >= 6) {
      try {
        await message.delete();
        await message.channel.send(
          "🚫 " + message.author.toString() + ", too many mentions."
        );
      } catch (error) {}
      return;
    }
  }

  if (!content.startsWith(PREFIX)) return;

  const args = content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift();
  if (!command) return;
  const cmd = command.toLowerCase();

  if (cmd === "setup") {
    await deleteCommand(message);
    return message.channel.send(
      "🐕 **PRLNGZZ DOG BOT SETUP & COMMANDS**\n\n" +
        "**⚙️ Server Configuration**\n" +
        "`--setwelcome #channel` - Sets welcome messages\n" +
        "`--setleave #channel` - Sets leave messages\n" +
        "`--ticketsetup #category` - Creates support panel\n" +
        "`--setmaxticks [num]` - Sets max concurrent tickets\n" +
        "`--setstats #channel` - Sets live stats tracker\n" +
        "`--setcompleted [num]` - Manually update completed orders count\n\n" +
        "**🎉 Giveaways & Fun**\n" +
        "`--giveaway [time] [winners] [prize]` - Start giveaway\n" +
        "`--afk [duration] [reason]` - Set your AFK status\n\n" +
        "**🔨 Moderation**\n" +
        "`--ban @user [reason]` | `--unban [ID]`\n" +
        "`--kick @user [reason]`\n" +
        "`--mute / --timeout @user [time]` | `--unmute @user`\n" +
        "`--warn @user [reason]` | `--warnings @user`\n" +
        "`--clearwarnings @user`\n" +
        "`--clear / --purge [1-100]`\n" +
        "`--lock` | `--unlock` | `--slowmode [secs]`\n" +
        "`--nick @user [name]` | `--role @user [role]`\n\n" +
        "**📊 Info**\n" +
        "`--userinfo @user` | `--serverinfo` | `--say [msg]`"
    );
  }

  if (cmd === "help") {
    await deleteCommand(message);
    return message.channel.send(
      "🐕 **PRLNGZZ DOG QUICK HELP**\n\n" +
        "Use `--setup` to view all available administrative, moderation, and utility commands."
    );
  }

  if (cmd === "setwelcome") {
    if (!hasPermission(message, PermissionsBitField.Flags.ManageGuild)) {
      return message.reply("❌ You need **Manage Server**.");
    }
    const channel = message.mentions.channels.first();
    if (!channel) {
      return message.reply("❌ Usage: `--setwelcome #channel`");
    }
    data.welcomeChannels[guildId] = channel.id;
    saveData();
    await deleteCommand(message);
    return message.channel.send("✅ Welcome channel set to " + channel.toString());
  }

  if (cmd === "setleave") {
    if (!hasPermission(message, PermissionsBitField.Flags.ManageGuild)) {
      return message.reply("❌ You need **Manage Server**.");
    }
    const channel = message.mentions.channels.first();
    if (!channel) {
      return message.reply("❌ Usage: `--setleave #channel`");
    }
    data.leaveChannels[guildId] = channel.id;
    saveData();
    await deleteCommand(message);
    return message.channel.send("✅ Leave channel set to " + channel.toString());
  }

  if (cmd === "setmaxticks") {
    if (!hasPermission(message, PermissionsBitField.Flags.ManageGuild)) {
      return message.reply("❌ You need **Manage Server**.");
    }
    const limit = Number(args[0]);
    if (!Number.isInteger(limit) || limit < 1) {
      return message.reply("❌ Usage: `--setmaxticks 5`");
    }
    data.maxOpenTickets = limit;
    saveData();
    await deleteCommand(message);
    return message.channel.send(`✅ Max open tickets set to **${limit}**.`);
  }

  if (cmd === "setcompleted") {
    if (!hasPermission(message, PermissionsBitField.Flags.ManageGuild)) {
      return message.reply("❌ You need **Manage Server**.");
    }
    const count = Number(args[0]);
    if (!Number.isInteger(count) || count < 0) {
      return message.reply("❌ Usage: `--setcompleted 39`");
    }
    if (!data.completedOrders) data.completedOrders = {};
    data.completedOrders[guildId] = count;
    saveData();
    await deleteCommand(message);
    await updateStatsChannels(message.guild);
    return message.channel.send(`✅ Completed orders count set to **${count}**.`);
  }

  if (cmd === "setstats") {
    if (!hasPermission(message, PermissionsBitField.Flags.ManageGuild)) {
      return message.reply("❌ You need **Manage Server**.");
    }
    const channel = message.mentions.channels.first();
    if (!channel) {
      return message.reply("❌ Usage: `--setstats #channel`");
    }

    const currentCompleted = (data.completedOrders && data.completedOrders[guildId] !== undefined)
      ? data.completedOrders[guildId]
      : 39;

    const initialMsg = await channel.send(
      `Completed Orders: ${currentCompleted}\nOrders In Progress: 30\nCreators 4`
    );

    data.statsChannels[guildId] = {
      channelId: channel.id,
      messageId: initialMsg.id
    };
    saveData();
    await deleteCommand(message);
    await updateStatsChannels(message.guild);
    return message.channel.send("✅ Stats live tracker channel configured.");
  }

  if (cmd === "afk") {
    const duration = parseDuration(args[0]);
    if (!duration) {
      return message.reply("❌ Usage: `--afk 5h [reason]`");
    }
    const reason = args.slice(1).join(" ") || "AFK";
    data.afkUsers[message.author.id] = {
      expiresAt: Date.now() + duration,
      reason: reason
    };
    saveData();
    await deleteCommand(message);
    return message.channel.send(
      `💤 ${message.author.toString()} is now AFK for **${durationText(duration)}**. Reason: ${reason}`
    );
  }

  if (cmd === "warn") {
    if (!hasPermission(message, PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply("❌ You need **Moderate Members**.");
    }
    const members = getMentionedMembers(message);
    if (members.length === 0) {
      return message.reply("❌ Usage: `--warn @user reason`");
    }
    const reason = getNonMentionArgs(message, args).join(" ") || "No reason provided";
    if (!data.warnings[guildId]) {
      data.warnings[guildId] = {};
    }
    members.forEach(function (member) {
      if (!data.warnings[guildId][member.id]) {
        data.warnings[guildId][member.id] = [];
      }
      data.warnings[guildId][member.id].push({
        reason: reason,
        moderator: message.author.id,
        timestamp: Date.now()
      });
    });
    saveData();
    await deleteCommand(message);
    return message.channel.send(
      "⚠️ Warned " +
        members.map(m => m.toString()).join(", ") +
        ".\nReason: **" +
        reason +
        "**"
    );
  }

  if (cmd === "warnings") {
    const member = getMember(message, args[0]);
    if (!member) {
      return message.reply("❌ Usage: `--warnings @user`");
    }
    const guildWarnings = data.warnings[guildId] || {};
    const warnings = guildWarnings[member.id] || [];
    if (warnings.length === 0) {
      await deleteCommand(message);
      return message.channel.send("✅ " + member.toString() + " has no warnings.");
    }
    let text = "⚠️ **Warnings for " + member.user.tag + "**\n\n";
    warnings.forEach(function (warning, index) {
      text += "**" + (index + 1) + ".** " + warning.reason + "\n";
    });
    await deleteCommand(message);
    return message.channel.send(text);
  }

  if (cmd === "clearwarnings" || cmd === "unwarn") {
    if (!hasPermission(message, PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply("❌ You need **Moderate Members**.");
    }
    const members = getMentionedMembers(message);
    if (members.length === 0) {
      return message.reply("❌ Usage: `--clearwarnings @user`");
    }
    if (data.warnings[guildId]) {
      members.forEach(function (m) {
        delete data.warnings[guildId][m.id];
      });
      saveData();
    }
    await deleteCommand(message);
    return message.channel.send(
      "✅ Cleared all warnings for " + members.map(m => m.toString()).join(", ") + "."
    );
  }

  if (cmd === "ban") {
    if (!hasPermission(message, PermissionsBitField.Flags.BanMembers)) {
      return message.reply("❌ You need **Ban Members**.");
    }
    const members = getMentionedMembers(message);
    if (members.length === 0) {
      return message.reply("❌ Usage: `--ban @user reason`");
    }
    const reason = getNonMentionArgs(message, args).join(" ") || "No reason provided";
    const failed = [];
    for (const member of members) {
      if (!member.bannable) {
        failed.push(member.toString());
        continue;
      }
      try {
        await member.ban({ reason: reason });
      } catch (error) {
        failed.push(member.toString());
      }
    }
    await deleteCommand(message);
    let result =
      "🔨 Banned " +
      members
        .filter(m => !failed.includes(m.toString()))
        .map(m => "<@" + m.id + ">")
        .join(", ") +
      ".";
    if (failed.length) {
      result += "\n❌ Couldn't ban " + failed.join(", ") + ".";
    }
    return message.channel.send(result);
  }

  if (cmd === "unban") {
    if (!hasPermission(message, PermissionsBitField.Flags.BanMembers)) {
      return message.reply("❌ You need **Ban Members**.");
    }
    const userId = args[0];
    if (!userId) {
      return message.reply("❌ Usage: `--unban USER_ID`");
    }
    try {
      await message.guild.members.unban(userId);
      await deleteCommand(message);
      return message.channel.send("✅ Unbanned `" + userId + "`.");
    } catch (error) {
      return message.reply("❌ Could not unban that user.");
    }
  }

  if (cmd === "kick") {
    if (!hasPermission(message, PermissionsBitField.Flags.KickMembers)) {
      return message.reply("❌ You need **Kick Members**.");
    }
    const members = getMentionedMembers(message);
    if (members.length === 0) {
      return message.reply("❌ Usage: `--kick @user reason`");
    }
    const reason = getNonMentionArgs(message, args).join(" ") || "No reason provided";
    const failed = [];
    for (const member of members) {
      if (!member.kickable) {
        failed.push(member.toString());
        continue;
      }
      try {
        await member.kick(reason);
      } catch (error) {
        failed.push(member.toString());
      }
    }
    await deleteCommand(message);
    let result =
      "👢 Kicked " +
      members
        .filter(m => !failed.includes(m.toString()))
        .map(m => "<@" + m.id + ">")
        .join(", ") +
      ".";
    if (failed.length) {
      result += "\n❌ Couldn't kick " + failed.join(", ") + ".";
    }
    return message.channel.send(result);
  }

  if (cmd === "mute" || cmd === "timeout") {
    if (!hasPermission(message, PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply("❌ You need **Moderate Members**.");
    }
    const members = getMentionedMembers(message);
    if (members.length === 0) {
      return message.reply("❌ Usage: `--mute @user 10m`");
    }
    const otherArgs = getNonMentionArgs(message, args);
    let duration = 10 * 60 * 1000;
    if (otherArgs[0]) {
      const parsed = parseDuration(otherArgs[0]);
      if (parsed) duration = parsed;
    }
    const failed = [];
    for (const member of members) {
      try {
        await member.timeout(duration, "Moderator timeout");
      } catch (error) {
        failed.push(member.toString());
      }
    }
    await deleteCommand(message);
    let result =
      "🔇 " +
      members
        .filter(m => !failed.includes(m.toString()))
        .map(m => m.toString())
        .join(", ") +
      " timed out for **" +
      durationText(duration) +
      "**.";
    if (failed.length) {
      result += "\n❌ Couldn't timeout " + failed.join(", ") + ".";
    }
    return message.channel.send(result);
  }

  if (cmd === "unmute") {
    if (!hasPermission(message, PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply("❌ You need **Moderate Members**.");
    }
    const members = getMentionedMembers(message);
    if (members.length === 0) {
      return message.reply("❌ Usage: `--unmute @user`");
    }
    const failed = [];
    for (const member of members) {
      try {
        await member.timeout(null);
      } catch (error) {
        failed.push(member.toString());
      }
    }
    await deleteCommand(message);
    let result =
      "🔊 Unmuted " +
      members
        .filter(m => !failed.includes(m.toString()))
        .map(m => "<@" + m.id + ">")
        .join(", ") +
      ".";
    if (failed.length) {
      result += "\n❌ Couldn't unmute " + failed.join(", ") + ".";
    }
    return message.channel.send(result);
  }

  if (cmd === "clear" || cmd === "purge") {
    if (!hasPermission(message, PermissionsBitField.Flags.ManageMessages)) {
      return message.reply("❌ You need **Manage Messages**.");
    }
    const amount = Number(args[0]);
    if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
      return message.reply("❌ Use a number between 1 and 100.");
    }
    const deleted = await message.channel.bulkDelete(amount, true);
    await deleteCommand(message);
    return message.channel.send("🧹 Deleted **" + deleted.size + "** messages.");
  }

  if (cmd === "lock") {
    if (!hasPermission(message, PermissionsBitField.Flags.ManageChannels)) {
      return message.reply("❌ You need **Manage Channels**.");
    }
    await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
      SendMessages: false
    });
    await deleteCommand(message);
    return message.channel.send("🔒 Channel locked.");
  }

  if (cmd === "unlock") {
    if (!hasPermission(message, PermissionsBitField.Flags.ManageChannels)) {
      return message.reply("❌ You need **Manage Channels**.");
    }
    await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
      SendMessages: null
    });
    await deleteCommand(message);
    return message.channel.send("🔓 Channel unlocked.");
  }

  if (cmd === "slowmode") {
    if (!hasPermission(message, PermissionsBitField.Flags.ManageChannels)) {
      return message.reply("❌ You need **Manage Channels**.");
    }
    const seconds = Number(args[0]);
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 21600) {
      return message.reply("❌ Use a number between 0 and 21600.");
    }
    await message.channel.setRateLimitPerUser(seconds);
    await deleteCommand(message);
    return message.channel.send("🐌 Slowmode set to **" + seconds + " seconds**.");
  }

  if (cmd === "nick") {
    if (!hasPermission(message, PermissionsBitField.Flags.ManageNicknames)) {
      return message.reply("❌ You need **Manage Nicknames**.");
    }
    const members = getMentionedMembers(message);
    if (members.length === 0) {
      return message.reply("❌ Usage: `--nick @user NewName`");
    }
    const nickname = getNonMentionArgs(message, args).join(" ");
    if (!nickname) {
      return message.reply("❌ Enter a nickname.");
    }
    const failed = [];
    for (const member of members) {
      try {
        await member.setNickname(nickname);
      } catch (error) {
        failed.push(member.toString());
      }
    }
    await deleteCommand(message);
    let result =
      "✅ Changed nickname for " +
      members.filter(m => !failed.includes(m.toString())).map(m => m.toString()).join(", ") +
      " to **" +
      nickname +
      "**.";
    if (failed.length) {
      result += "\n❌ Couldn't change " + failed.join(", ") + ".";
    }
    return message.channel.send(result);
  }

  if (cmd === "role") {
    if (!hasPermission(message, PermissionsBitField.Flags.ManageRoles)) {
      return message.reply("❌ You need **Manage Roles**.");
    }
    const members = getMentionedMembers(message);
    if (members.length === 0) {
      return message.reply("❌ Usage: `--role @user roleName`");
    }
    const roleName = getNonMentionArgs(message, args).join(" ");
    const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
    if (!role) {
      return message.reply("❌ Role **" + roleName + "** doesn't exist.");
    }
    const failed = [];
    for (const member of members) {
      try {
        await member.roles.add(role);
      } catch (error) {
        failed.push(member.toString());
      }
    }
    await deleteCommand(message);
    updateStatsChannels(message.guild);
    return message.channel.send("✅ Updated roles successfully.");
  }

  if (cmd === "userinfo") {
    const member = getMember(message, args[0]) || message.member;
    await deleteCommand(message);
    return message.channel.send(
      "👤 **USER INFO**\n\nUsername: **" +
        member.user.tag +
        "**\nID: `" +
        member.id +
        "`\nJoined: <t:" +
        Math.floor(member.joinedTimestamp / 1000) +
        ":R>"
    );
  }

  if (cmd === "serverinfo") {
    await deleteCommand(message);
    return message.channel.send(
      "🏠 **SERVER INFO**\n\nName: **" +
        message.guild.name +
        "**\nID: `" +
        message.guild.id +
        "`\nMembers: **" +
        message.guild.memberCount +
        "**"
    );
  }

  if (cmd === "say") {
    if (!hasPermission(message, PermissionsBitField.Flags.ManageMessages)) {
      return message.reply("❌ You need **Manage Messages**.");
    }
    const text = message.content.slice(PREFIX.length + 3).trim();
    if (!text) return message.reply("❌ Usage: `--say message`");
    await message.delete().catch(() => {});
    return message.channel.send({ content: text, allowedMentions: { parse: ["users", "roles", "everyone"] } });
  }

  if (cmd === "ticketsetup") {
    if (!hasPermission(message, PermissionsBitField.Flags.ManageGuild)) {
      return message.reply("❌ You need **Manage Server**.");
    }
    const category = message.mentions.channels.first();
    if (!category || category.type !== ChannelType.GuildCategory) {
      return message.reply("❌ Usage: `--ticketsetup #category`");
    }
    data.ticketCategories[guildId] = category.id;
    saveData();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("create_ticket")
        .setLabel("Create Ticket")
        .setEmoji("🎫")
        .setStyle(ButtonStyle.Primary)
    );

    await message.channel.send({
      content: "🎫 **PRLNGZZ DOG SUPPORT**\n\nNeed help? Click the button below to create a private ticket.",
      components: [row]
    });
    await deleteCommand(message);
    return message.channel.send("✅ Ticket system configured.");
  }

  if (cmd === "giveaway") {
    if (!hasPermission(message, PermissionsBitField.Flags.ManageGuild)) {
      return message.reply("❌ You need **Manage Server**.");
    }
    const duration = parseDuration(args[0]);
    const winners = Number(args[1]);
    const prize = args.slice(2).join(" ");
    if (!duration || !winners || !prize) {
      return message.reply("❌ Usage: `--giveaway 10m 1 Prize`");
    }
    await deleteCommand(message);
    const id = guildId + "-" + Date.now();
    giveaways.set(id, { channelId: message.channel.id, entrants: new Set(), winners: winners, prize: prize });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("giveaway_" + id)
        .setLabel("Enter Giveaway")
        .setEmoji("🎉")
        .setStyle(ButtonStyle.Success)
    );

    const giveawayMessage = await message.channel.send({
      content: "🎉 **GIVEAWAY**\n\nPrize: **" + prize + "**\nWinners: **" + winners + "**\nEnds: <t:" + Math.floor((Date.now() + duration) / 1000) + ":R>\nEntries: **0**\n\nClick the button below to enter!",
      components: [row]
    });

    setTimeout(async function () {
      const giveaway = giveaways.get(id);
      if (!giveaway) return;
      giveaways.delete(id);
      const entrants = Array.from(giveaway.entrants);
      if (entrants.length === 0) {
        await giveawayMessage.edit({ content: "🎉 **GIVEAWAY ENDED**\n\nPrize: **" + prize + "**\n\n❌ Nobody entered.", components: [] }).catch(() => {});
        return;
      }
      const selected = [];
      while (selected.length < Math.min(winners, entrants.length)) {
        const random = entrants[Math.floor(Math.random() * entrants.length)];
        if (!selected.includes(random)) selected.push(random);
      }
      const winnerText = selected.map(id => "<@" + id + ">").join(", ");
      await giveawayMessage.edit({ content: "🎉 **GIVEAWAY ENDED**\n\nPrize: **" + prize + "**\n\n🏆 Winner(s): " + winnerText, components: [] }).catch(() => {});
      message.channel.send("🎉 Congratulations " + winnerText + "! You won **" + prize + "**!").catch(() => {});
    }, duration);
  }
});

client.on("interactionCreate", async function (interaction) {
  if (!interaction.isButton()) return;
  const guild = interaction.guild;
  const guildId = guild.id;

  if (interaction.customId === "create_ticket") {
    const categoryId = data.ticketCategories[guildId];
    if (!categoryId) {
      return interaction.reply({ content: "❌ Ticket system isn't configured.", ephemeral: true });
    }

    const category = guild.channels.cache.get(categoryId);
    if (category) {
      const activeCount = guild.channels.cache.filter(
        c => c.parentId === categoryId && c.name.match(/^\d+-/)
      ).size;
      const maxAllowed = data.maxOpenTickets || 5;
      if (activeCount >= maxAllowed) {
        return interaction.reply({
          content: `❌ Maximum open tickets limit reached (${maxAllowed}). Please wait for a ticket to be closed.`,
          ephemeral: true
        });
      }
    }

    data.ticketCount = (data.ticketCount || 30) + 1;
    saveData();

    const ticketNumber = data.ticketCount;
    const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15);
    const channelName = `${ticketNumber}-${safeName}`;

    const ticket = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: categoryId,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] }
      ]
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("close_ticket")
        .setLabel("Close Ticket")
        .setEmoji("🔒")
        .setStyle(ButtonStyle.Danger)
    );

    await ticket.send({
      content: "🎫 **PRLNGZZ DOG TICKET**\n\nWelcome " + interaction.user.toString() + "!\nExplain your issue here.\nClick **Close Ticket** when finished.",
      components: [row]
    });

    updateStatsChannels(guild);

    return interaction.reply({
      content: "✅ Ticket created: " + ticket.toString(),
      ephemeral: true
    });
  }

  if (interaction.customId === "close_ticket") {
    if (!data.completedOrders) data.completedOrders = {};
    const currentCompleted = data.completedOrders[guildId] !== undefined ? data.completedOrders[guildId] : 39;
    data.completedOrders[guildId] = currentCompleted + 1;
    saveData();

    await interaction.reply("🔒 Closing ticket in 5 seconds...");
    setTimeout(function () {
      interaction.channel.delete().catch(() => {});
      updateStatsChannels(guild);
    }, 5000);
    return;
  }

  if (interaction.customId.startsWith("giveaway_")) {
    const id = interaction.customId.substring(9);
    const giveaway = giveaways.get(id);
    if (!giveaway) {
      return interaction.reply({ content: "❌ This giveaway has ended.", ephemeral: true });
    }
    if (giveaway.entrants.has(interaction.user.id)) {
      return interaction.reply({ content: "❌ You're already entered.", ephemeral: true });
    }
    giveaway.entrants.add(interaction.user.id);

    const giveawayMessage = await interaction.channel.messages.fetch(interaction.message.id).catch(() => null);
    if (giveawayMessage) {
      const currentText = giveawayMessage.content.replace(
        /Entries: \*\*\d+\*\*/,
        "Entries: **" + giveaway.entrants.size + "**"
      );
      await giveawayMessage.edit({ content: currentText }).catch(() => {});
    }

    return interaction.reply({ content: "✅ You're entered! Good luck 🍀", ephemeral: true });
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN is missing.");
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
