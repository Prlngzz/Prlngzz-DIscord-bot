const {
  Client,
  GatewayIntentBits
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const prefix = "--";

client.once("ready", () => {
  console.log(`Fleasion bot online as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  if (command === "say") {
    const text = args.join(" ");
    if (!text) return;

    await message.delete().catch(() => {});
    return message.channel.send(text);
  }

  if (command === "help") {
    return message.reply(
`**FLEASION BOT**

--ban @user
--kick @user
--mute @user 1h
--unmute @user
--warn @user reason
--clear 20
--lock
--unlock
--slowmode 10
--nick @user name
--userinfo @user
--serverinfo
--say message
--help`
    );
  }
});

client.login(process.env.DISCORD_TOKEN);