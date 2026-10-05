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

async function deleteCommand(message) {
await message.delete().catch(function () {});
}

function hasPermission(message, permission) {
return message.member.permissions.has(permission);
}

function getMember(message, value) {
if (!value) return null;

const mentioned = message.mentions.members.first();

if (mentioned) {
return mentioned;
}

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

if (!welcomeChannelId) return;

const channel = member.guild.channels.cache.get(welcomeChannelId);

if (!channel) return;

channel.send(
"👋 Welcome " +
member.user.toString() +
" to **" +
member.guild.name +
"**!"
).catch(function () {});
});

client.on("messageCreate", async function (message) {
if (!message.guild) return;
if (message.author.bot) return;

const content = message.content.trim();

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
await message.member.timeout(15000, "Anti-spam");

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

if (cmd === "setup") {
await deleteCommand(message);

return message.channel.send(
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
"`--ban @user @user2 reason`\n" +
"`--unban USER_ID`\n" +
"`--kick @user @user2 reason`\n" +
"`--mute @user @user2 10m`\n" +
"`--unmute @user @user2`\n" +
"`--timeout @user @user2 10m`\n" +
"`--warn @user @user2 reason`\n" +
"`--warnings @user`\n" +
"`--clearwarnings @user @user2`\n" +
"`--clear 10`\n" +
"`--purge 10`\n" +
"`--lock`\n" +
"`--unlock`\n" +
"`--slowmode 5`\n" +
"`--nick @user @user2 NewName`\n" +
"`--role @user @user2 customer`\n\n" +

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

if (cmd === "help") {
await deleteCommand(message);

return message.channel.send(
"🐕 **PRLNGZZ DOG**\n\n" +

"**Moderation**\n" +
"`--ban @user @user2 reason`\n" +
"`--unban USER_ID`\n" +
"`--kick @user @user2 reason`\n" +
"`--mute @user @user2 10m`\n" +
"`--unmute @user @user2`\n" +
"`--timeout @user @user2 10m`\n" +
"`--warn @user @user2 reason`\n" +
"`--warnings @user`\n" +
"`--clearwarnings @user @user2`\n" +
"`--clear 10`\n" +
"`--purge 10`\n" +
"`--lock`\n" +
"`--unlock`\n" +
"`--slowmode 5`\n" +
"`--nick @user Name`\n" +
"`--role @user @user2 customer`\n\n" +

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

if (cmd === "setwelcome") {
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

await deleteCommand(message);

return message.channel.send(
"✅ Welcome channel set to " +
channel.toString()
);
}

if (cmd === "warn") {
if (!hasPermission(message, PermissionsBitField.Flags.ModerateMembers)) {
return message.reply("❌ You need **Moderate Members**.");
}

const members = getMentionedMembers(message);

if (members.length === 0) {
return message.reply(
"❌ Usage: `--warn @user @user2 reason`"
);
}

const reason =
getNonMentionArgs(message, args).join(" ") ||
"No reason provided";

const guildId = message.guild.id;

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
members.map(function (m) {
return m.toString();
}).join(", ") +
".\nReason: **" +
reason +
"**"
);
}

if (cmd === "warnings") {
const member = getMember(message, args[0]);

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
await deleteCommand(message);

return message.channel.send(
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

await deleteCommand(message);

return message.channel.send(text);
}

if (cmd === "clearwarnings" || cmd === "unwarn") {
if (!hasPermission(message, PermissionsBitField.Flags.ModerateMembers)) {
return message.reply("❌ You need **Moderate Members**.");
}

const members = getMentionedMembers(message);

if (members.length === 0) {
return message.reply(
"❌ Usage: `--clearwarnings @user @user2`"
);
}

if (data.warnings[message.guild.id]) {
members.forEach(function (m) {
delete data.warnings[message.guild.id][m.id];
});

saveData();
}

await deleteCommand(message);

return message.channel.send(
"✅ Cleared all warnings for " +
members.map(function (m) {
return m.toString();
}).join(", ") +
"."
);
}

if (cmd === "ban") {
if (!hasPermission(message, PermissionsBitField.Flags.BanMembers)) {
return message.reply("❌ You need **Ban Members**.");
}

const members = getMentionedMembers(message);

if (members.length === 0) {
return message.reply(
"❌ Usage: `--ban @user @user2 reason`"
);
}

const reason =
getNonMentionArgs(message, args).join(" ") ||
"No reason provided";

const failed = [];

for (const member of members) {
if (!member.bannable) {
failed.push(member.toString());
continue;
}

try {
await member.ban({
reason: reason
});
} catch (error) {
failed.push(member.toString());
}
}

await deleteCommand(message);

let result =
"🔨 Banned " +
members
.filter(function (m) {
return !failed.includes(m.toString());
})
.map(function (m) {
return "<@" + m.id + ">";
})
.join(", ") +
".";

if (failed.length) {
result +=
"\n❌ Couldn't ban " +
failed.join(", ") +
".";
}

return message.channel.send(result);
}

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
await message.guild.members.unban(userId);

await deleteCommand(message);

return message.channel.send(
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

if (cmd === "kick") {
if (!hasPermission(message, PermissionsBitField.Flags.KickMembers)) {
return message.reply("❌ You need **Kick Members**.");
}

const members = getMentionedMembers(message);

if (members.length === 0) {
return message.reply(
"❌ Usage: `--kick @user @user2 reason`"
);
}

const reason =
getNonMentionArgs(message, args).join(" ") ||
"No reason provided";

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
.filter(function (m) {
return !failed.includes(m.toString());
})
.map(function (m) {
return "<@" + m.id + ">";
})
.join(", ") +
".";

if (failed.length) {
result +=
"\n❌ Couldn't kick " +
failed.join(", ") +
".";
}

return message.channel.send(result);
}

if (cmd === "mute" || cmd === "timeout") {
if (!hasPermission(message, PermissionsBitField.Flags.ModerateMembers)) {
return message.reply("❌ You need **Moderate Members**.");
}

const members = getMentionedMembers(message);

if (members.length === 0) {
return message.reply(
"❌ Usage: `--mute @user @user2 10m`"
);
}

const otherArgs =
getNonMentionArgs(message, args);

let duration = 10 * 60 * 1000;

if (otherArgs[0]) {
const parsed = parseDuration(otherArgs[0]);

if (parsed) {
duration = parsed;
}
}

if (duration > 28 * 24 * 60 * 60 * 1000) {
return message.reply(
"❌ Maximum timeout is 28 days."
);
}

const failed = [];

for (const member of members) {
try {
await member.timeout(
duration,
"Moderator timeout"
);
} catch (error) {
failed.push(member.toString());
}
}

await deleteCommand(message);

let result =
"🔇 " +
members
.filter(function (m) {
return !failed.includes(m.toString());
})
.map(function (m) {
return m.toString();
})
.join(", ") +
" timed out for **" +
durationText(duration) +
"**.";

if (failed.length) {
result +=
"\n❌ Couldn't timeout " +
failed.join(", ") +
".";
}

return message.channel.send(result);
}

if (cmd === "unmute") {
if (!hasPermission(message, PermissionsBitField.Flags.ModerateMembers)) {
return message.reply("❌ You need **Moderate Members**.");
}

const members = getMentionedMembers(message);

if (members.length === 0) {
return message.reply(
"❌ Usage: `--unmute @user @user2`"
);
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
.filter(function (m) {
return !failed.includes(m.toString());
})
.map(function (m) {
return "<@" + m.id + ">";
})
.join(", ") +
".";

if (failed.length) {
result +=
"\n❌ Couldn't unmute " +
failed.join(", ") +
".";
}

return message.channel.send(result);
}

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

await deleteCommand(message);

return message.channel.send(
"🧹 Deleted **" +
deleted.size +
"** messages."
);
}

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

await deleteCommand(message);

return message.channel.send(
"🔒 Channel locked."
);
}

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

await deleteCommand(message);

return message.channel.send(
"🔓 Channel unlocked."
);
}

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

await deleteCommand(message);

return message.channel.send(
"🐌 Slowmode set to **" +
seconds +
" seconds**."
);
}

if (cmd === "nick") {
if (!hasPermission(message, PermissionsBitField.Flags.ManageNicknames)) {
return message.reply("❌ You need **Manage Nicknames**.");
}

const members = getMentionedMembers(message);

if (members.length === 0) {
return message.reply(
"❌ Usage: `--nick @user @user2 NewName`"
);
}

const nickname =
getNonMentionArgs(message, args).join(" ");

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
"✅ Changed the nickname of " +
members
.filter(function (m) {
return !failed.includes(m.toString());
})
.map(function (m) {
return m.toString();
})
.join(", ") +
" to **" +
nickname +
"**.";

if (failed.length) {
result +=
"\n❌ Couldn't change " +
failed.join(", ") +
".";
}

return message.channel.send(result);
}

if (cmd === "role") {
if (!hasPermission(message, PermissionsBitField.Flags.ManageRoles)) {
return message.reply("❌ You need **Manage Roles**.");
}

const members = getMentionedMembers(message);

if (members.length === 0) {
return message.reply(
"❌ Usage: `--role @user @user2 customer`"
);
}

const roleName =
getNonMentionArgs(message, args).join(" ");

if (!roleName) {
return message.reply(
"❌ Usage: `--role @user @user2 customer`"
);
}

const role =
message.guild.roles.cache.find(function (r) {
return r.name.toLowerCase() === roleName.toLowerCase();
});

if (!role) {
return message.reply(
"❌ Role **" +
roleName +
"** doesn't exist."
);
}

if (role.managed) {
return message.reply(
"❌ That role is managed by Discord."
);
}

const botMember = message.guild.members.me;

if (!botMember) {
return message.reply(
"❌ I can't find my bot member."
);
}

if (
role.position >=
botMember.roles.highest.position
) {
return message.reply(
"❌ That role is above my highest role."
);
}

const failed = [];

for (const member of members) {
if (
member.roles.highest.position >=
botMember.roles.highest.position
) {
failed.push(member.toString());
continue;
}

try {
await member.roles.add(role);
} catch (error) {
failed.push(member.toString());
}
}

await deleteCommand(message);

let result =
"✅ Gave **" +
role.name +
"** to " +
members
.filter(function (m) {
return !failed.includes(m.toString());
})
.map(function (m) {
return "<@" + m.id + ">";
})
.join(", ") +
".";

if (failed.length) {
result +=
"\n❌ Couldn't give the role to " +
failed.join(", ") +
".";
}

return message.channel.send(result);
}

if (cmd === "userinfo") {
const member =
getMember(message, args[0]) ||
message.member;

await deleteCommand(message);

return message.channel.send(
"👤 **USER INFO**\n\n" +
"Username: **" +
member.user.tag +
"**\n" +
"ID: `" +
member.id +
"`\n" +
"Joined: <t:" +
Math.floor(
member.joinedTimestamp / 1000
) +
":R>"
);
}

if (cmd === "serverinfo") {
await deleteCommand(message);

return message.channel.send(
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
"❌ Usage: `--say message`"
);
}

await message.delete().catch(function () {});

return message.channel.send({
content: text,
allowedMentions: {
parse: [
"users",
"roles",
"everyone"
]
}
});
}

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
category.type !== ChannelType.GuildCategory
) {
return message.reply(
"❌ Usage: `--ticketsetup #category`\n" +
"You must mention a category."
);
}

data.ticketCategories[message.guild.id] =
category.id;

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

await deleteCommand(message);

return message.channel.send(
"✅ Ticket system configured."
);
}

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

await deleteCommand(message);

const id =
message.guild.id +
"-" +
Date.now();

giveaways.set(id, {
channelId:
message.channel.id,
entrants:
new Set(),
winners:
winners,
prize:
prize
});

const row =
new ActionRowBuilder().addComponents(
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
(Date.now() +
duration) /
1000
) +
":R>\n" +
"Entries: **0**\n\n" +
"Click the button below to enter!",
components: [row]
});

setTimeout(
async function () {
const giveaway =
giveaways.get(id);

if (!giveaway) return;

giveaways.delete(id);

const entrants =
Array.from(
giveaway.entrants
);

if (entrants.length === 0) {
await giveawayMessage
.edit({
content:
"🎉 **GIVEAWAY ENDED**\n\n" +
"Prize: **" +
prize +
"**\n\n" +
"❌ Nobody entered.",
components: []
})
.catch(
function () {}
);

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
.map(function (id) {
return (
"<@" +
id +
">"
);
})
.join(", ");

await giveawayMessage
.edit({
content:
"🎉 **GIVEAWAY ENDED**\n\n" +
"Prize: **" +
prize +
"**\n\n" +
"🏆 Winner(s): " +
winnerText,
components: []
})
.catch(
function () {}
);

message.channel.send(
"🎉 Congratulations " +
winnerText +
"! You won **" +
prize +
"**!"
).catch(
function () {}
);
},
duration
);

return;
}
});

client.on(
"interactionCreate",
async function (interaction) {
if (!interaction.isButton()) return;

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
.replace(
/[^a-z0-9]/g,
""
)
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

type:
ChannelType.GuildText,

parent:
categoryId,

permissionOverwrites: [
{
id:
guild.roles
.everyone
.id,

deny: [
PermissionsBitField
.Flags
.ViewChannel
]
},

{
id:
interaction.user
.id,

allow: [
PermissionsBitField
.Flags
.ViewChannel,

PermissionsBitField
.Flags
.SendMessages,

PermissionsBitField
.Flags
.ReadMessageHistory
]
}
]
});

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

if (
interaction.customId ===
"close_ticket"
) {
await interaction.reply(
"🔒 Closing ticket in 5 seconds..."
);

setTimeout(
function () {
interaction.channel
.delete()
.catch(
function () {}
);
},
5000
);

return;
}

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

const giveawayMessage =
await interaction.channel.messages.fetch(
interaction.message.id
).catch(function () {
return null;
});

if (giveawayMessage) {
const currentText =
giveawayMessage.content.replace(
/Entries: \*\*\d+\*\*/,
"Entries: **" +
giveaway.entrants.size +
"**"
);

await giveawayMessage.edit({
content: currentText
}).catch(function () {});
}

return interaction.reply({
content:
"✅ You're entered! Good luck 🍀",
ephemeral: true
});
}
}
);

if (!process.env.DISCORD_TOKEN) {
console.error(
"❌ DISCORD_TOKEN is missing."
);

process.exit(1);
}

client.login(
process.env.DISCORD_TOKEN
);
