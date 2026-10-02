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
