import { MusicBrainZ } from "./src/musicBrainz.ts";

const testISRC = 'USWU39703049';

const denoBrainz = new MusicBrainZ('0.0.1','STMP','STMPFork@waterwolf.net');
console.log(`UA Reporting as ${denoBrainz.ua} `)

const mbIds = await denoBrainz.getMbIdsFromISRC(testISRC);
if (mbIds.error){
    console.log(`Failed to get array with error: ${mbIds.error}\n`)
    Deno.exit();
}

console.log(mbIds);

mbIds.result.forEach(async (mbId: string) => {
    const thumbnail = await denoBrainz.getThumbnailFromMbId(mbId);

    if(thumbnail?.error) return;
    // if (!thumbnail?.result.images.map((i:ImageObject) => i.types.includes('Front'))) return;
    console.log(thumbnail?.result?.images.filter(i => i.types.includes('Front')));
});
