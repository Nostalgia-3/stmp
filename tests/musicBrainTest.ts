import { MusicBrainz } from "../src/musicBrainz.ts";

const testISRC = 'USWU39703049';

const denoBrainz = new MusicBrainz('stmp/0.0.1 (STMPFork@waterwolf.net)');
const mbIds = await denoBrainz.getMbIdsFromISRC(testISRC);
if (mbIds.error) {
    console.log(`Failed to get array with error: ${mbIds.error}\n`)
    Deno.exit();
}

// console.log(mbIds);

mbIds.result.forEach(async (mbId: string) => {
    const thumbnail = await denoBrainz.getThumbnailFromMbId(mbId);

    if (thumbnail?.error) return;
    // if (!thumbnail?.result.images.map((i:ImageObject) => i.types.includes('Front'))) return;
    console.log(thumbnail?.result?.filter(i => i.types.includes('Front')));
});
