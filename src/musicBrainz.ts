interface IRSCRecording {
    title: string,
    video: boolean,
    disambiguation: string,
    "first-release-date": string,
    id: string,
    length: number
}

export interface ImageObject {
    types: string[],
    front: boolean,
    back: boolean,
    edit: number,
    image: string,
    comment: string,
    approved: boolean,
    id: string,
    thumbnails: {
      large: string,
      small: string
    }
  }

export class MusicBrainZ {
    private reportedVersion: string
    private  contactInfo: string;
    private  appName: string;
    ua: string;
    constructor(reportedVersion: string, appName: string, contactInfo: string){
        this.reportedVersion = reportedVersion;
        this.contactInfo = contactInfo;
        this.appName = appName;
        this.ua = `${this.appName}/${this.reportedVersion} (${this.contactInfo})`
    }

    async getMbIdsFromISRC(isrc: string){
        const result = await (await fetch(`https://musicbrainz.org/ws/2/recording/?query=isrc:${isrc}&fmt=json`,{
            headers: {
                'User-Agent': this.ua
            }
        })).json();
        if(result.length == 0 || result.length > 25) return {result: [], error: 'Correct track coulden\'t be found.'}
        if(result.error) return {result: [],error: result.error}
        const ids = [];
        for (const recording of result.recordings){
            for(const release of recording.releases){
                ids.push(release.id)
            }
        }
        console.log()
        return {result: ids,error: undefined}
    }

    async getThumbnailFromMbId(MbId: string): Promise<{result: undefined | {images:ImageObject[]},error: undefined | string}>{
        const rawResult = await (await fetch(`https://coverartarchive.org/release/${MbId}`,{
            headers: {
                'User-Agent': this.ua
            }
        }));
        const code = rawResult.status
        switch (code) {
            case 200: {
                return {result: await rawResult.json(), error: undefined};
            }
            case 400: { return {result: undefined, error: `${MbId} cannot be parsed as a valid UUID.`}; }
            case 404: { return {result: undefined, error: `There is no release with this MBID.`}; }
            case 406: { return {result: undefined, error: `The server is unable to generate a response suitable to the Accept header.`}; }
            case 503: { return {result: undefined, error: `The user has exceeded their rate limit.`}; }
            default: {return {result: undefined, error: `No Vaild Response Code`}}
        }
    }


}