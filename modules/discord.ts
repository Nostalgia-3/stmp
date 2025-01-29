// TODO: make this

import { DiscordIPC, ActivityType } from "../src/ipc.ts";

const ipc = new DiscordIPC('1331978897146908723');

ipc.connect();

ipc.setActivity({
    details: '{title}', state: '{artists}', type: ActivityType.Listening,
    assets: {
        large_text: 'In {album}'
    }
});

setInterval(()=>{});