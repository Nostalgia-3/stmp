export type IRSCRelease = {
    title: string,
    video: boolean,
    disambiguation: string,
    "first-release-date": string,
    id: string,
    length: number
};

export type Artist = {
    name: string,
    artist: Record<string, unknown>
}

export type ISRCRecording = {
    id: string,
    score: number,
    title: string,
    length: number,
    video?: null,
    "artist-credit": Artist[],
    "first-release-date": string,
    releases: IRSCRelease[]
}

export type ISRCFindResponse = {
    created: string,
    count: number,
    offset: number,
    recordings: ISRCRecording[],
    error?: string
};

export type ImageObject = {
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

export class MusicBrainz {
    protected userAgent: string;

    /**
     * @param userAgent The recommend user agent is `App name/App version (Contact info)`
     */
    constructor(userAgent: string) {
        this.userAgent = userAgent;
    }

    async getMbIdsFromISRC(isrc: string) {
        const result = await (
            await fetch(`https://musicbrainz.org/ws/2/recording/?query=isrc:${isrc}&fmt=json`, {
            headers: {
                'User-Agent': this.userAgent
            }
        })).json() as ISRCFindResponse;

        if(result.recordings.length == 0 || result.recordings.length > 25)
            return { result: [], error: `A track with the ISRC "${isrc}" couldn't be found.` };

        if(result.error) return { result: [], error: result.error };
        
        const ids: string[] = [];
        for (const recording of result.recordings) {
            for (const release of recording.releases) {
                ids.push(release.id);
            }
        }

        return { result: ids };
    }

    async getThumbnailFromMbId(mbId: string): Promise<{ result?: ImageObject[], error?: string }> {
        const rawResult = (await fetch(`https://coverartarchive.org/release/${mbId}`, {
            headers: {
                'User-Agent': this.userAgent
            }
        }));

        switch (rawResult.status) {
            case 200: return { result: (await rawResult.json()).images };
            case 400: return { error: `${mbId} cannot be parsed as a valid UUID.` };
            case 404: return { error: `There is no release with this MBID.` };
            case 406: return { error: `The server is unable to generate a response suitable to the Accept header.` };
            case 503: return { error: `The user has exceeded their rate limit.` };
            default:  return { error: `No Vaild Response Code` }
        }
    }

    setUserAgent(s: string) { this.userAgent = s; }
    getUserAgent() { return this.userAgent; }
}