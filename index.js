const giveaways = new Map();

/* ========================= GIVEAWAY STORAGE ========================= */

function saveGiveaways() {
    data.giveaways = {};

    for (const [id, giveaway] of giveaways.entries()) {
        data.giveaways[id] = {
            channelId: giveaway.channelId,
            messageId: giveaway.messageId,
            entrants: Array.from(giveaway.entrants),
            winners: giveaway.winners,
            prize: giveaway.prize,
            endTime: giveaway.endTime
        };
    }

    saveData();
}

function loadGiveaways() {
    if (!data.giveaways) return;

    for (const [id, giveaway] of Object.entries(data.giveaways)) {
        giveaways.set(id, {
            channelId: giveaway.channelId,
            messageId: giveaway.messageId,
            entrants: new Set(giveaway.entrants || []),
            winners: giveaway.winners,
            prize: giveaway.prize,
            endTime: giveaway.endTime
        });
    }
}

loadGiveaways();
