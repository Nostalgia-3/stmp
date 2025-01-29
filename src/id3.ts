// ID3 parser and such

import { Buffer } from 'node:buffer';
import { FancyBuffer } from './utils.ts';

export enum Genre {
    Blues, ClassicRock, Country, Dance, Disco, Funk, Grunge, HipHop, Jazz,
    Metal, NewAge, Oldies, Other, Pop, RnB, Rap, Reggae, Rock, Techno,
    Industrial, Alternative, Ska, DeathMetal, Pranks, Soundtrack, EuroTechno,
    Ambient, TripHop, Vocal, JazzFunk, Fusion, Trance, Classical, Instrumental,
    Acid, House, Game, SoundClip, Gospel, Noise, AlternRock, Bass, Soul, Punk,
    Space, Meditative, InstrumentalPop, InstrumentalRock, Ethnic, Gothic,
    Darkwave, TechnoIndustrial, Electronic, PopFolk, Eurodance, Dream,
    SouthernRock, Comedy, Cult, Gangsta, Top40, ChristianRap, PopFunk, Jungle,
    NativeAmerican, Cabaret, NewWave, Psychadelic, Rave, Showtunes, Trailer,
    LoFi, Tribal, AcidPunk, AcidJazz, Polka, Retro, Musical, RockAndRoll,
    HardRock, Folk, FolkRock, NationalFolk, Swing, FastFusion, Bebob, Latin,
    Revival, Celtic, Bluegrass, Avantgarde, GothicRock, ProgressiveRock,
    // fill in the rest (http://www.mpgedit.org/mpgedit/mpeg_format/mpeghdr.htm#MPEGTAG)
}

export type Tag = {
    title?: string,
    artists?: string[],
    album?: string,
    year?: string,
    comment?: string,
    track?: number,
    totalTracks?: number,
    genre?: Genre,
    isrc?: string,
    extra: { name: string, value?: string }[]
};

function readTextString(fb: FancyBuffer, size: number) {
    const st = (fb.readU8() == 1) 
        ? fb.readLenUTF16String(size-2)
        : fb.readLenUTF8String(size-2);
    fb.skip(1);
    return st;
}

function getVersion3(fb: FancyBuffer, _file: string) {
    fb.skip(10);

    const t: Tag = { extra: [] };

    while(1) {
        const tag   = fb.readLenAsciiString(4);
        if(tag.length == 0) break;
        const size  = fb.readU32BE();
        const _flags = fb.readU16BE();

        if(size == 0) break;

        switch(tag) {
            case 'TYER':
                t.year = readTextString(fb, size);
            break;

            case 'TIT2':
                t.title = readTextString(fb, size);
            break;

            case `TPE1`:
                t.artists = readTextString(fb, size).split('/');
            break;

            case 'TRCK': {
                const tInfo = readTextString(fb, size).split('/').map((v)=>parseInt(v));
                if(tInfo[0]) t.track = tInfo[0];
                if(tInfo[1]) t.totalTracks = tInfo[1];
            break; }

            case 'TALB':
                t.album = readTextString(fb, size);
            break;

            case 'TSRC':
                t.isrc = readTextString(fb, size);
            break;

            default:
                if(!tag.startsWith('T')) {
                    fb.skip(size);
                    t.extra.push({ name: tag });
                } else {
                    t.extra.push({ name: tag, value: tag.startsWith('T') ? readTextString(fb, size) : undefined });
                }
            break;
        }
    }

    return t;
}

function getVersion4(fb: FancyBuffer, _file: string) {
    fb.skip(10);

    const t: Tag = { extra: [] };
    while(1) {
        const tag   = fb.readLenUTF8String(4);
        if(tag.length == 0 || tag == '\0\0\0\0') break;
        const size  = (fb.readU8() << 21) | (fb.readU8() << 14) | (fb.readU8() << 7) | fb.readU8();
        const _flags = fb.readU16BE();

        switch(tag) {
            case 'TYER':
                t.year = readTextString(fb, size);
            break;

            case 'TIT2':
                t.title = readTextString(fb, size);
            break;

            case `TPE1`:
                t.artists = readTextString(fb, size).split('/');
            break;

            case 'TRCK': {
                const tInfo = readTextString(fb, size).split('/').map((v)=>parseInt(v));
                t.track = tInfo[0];
                t.totalTracks = tInfo[1];
            break; }

            case 'TALB':
                t.album = readTextString(fb, size);
            break;

            case 'TSSE':
                // console.log(readTextString(fb, size));
                fb.skip(size+10);
            break;

            default:
                if(!tag.startsWith('T')) {
                    fb.skip(size);
                    t.extra.push({ name: tag });
                } else {
                    t.extra.push({ name: tag, value: tag.startsWith('T') ? readTextString(fb, size) : undefined });
                }
            break;
        }
    }

    return t;
}

function getLegacy(fb: FancyBuffer): Tag | undefined {
    const b = fb.readLenAsciiString(3);
    if(b != 'TAG')
        return;

    return {
        title:  fb.readLenUTF8String(30).split('\0')[0],
        artists: [fb.readLenUTF8String(30).split('\0')[0]],
        album:  fb.readLenUTF8String(30).split('\0')[0],
        year:   fb.readLenUTF8String(4),
        comment:fb.readLenUTF8String(30).split('\0')[0],
        genre:  fb.readU8(),
        extra: []
    };
}

export async function getFileID3(file: string): Promise<Tag | undefined> {
    // This lets me not load the entire file, which *should*
    // make it faster (I think, anyways)
    const f = await Deno.open(file, { read: true, write: false });
    f.seekSync(0, Deno.SeekMode.Start);

    const id3v2 = new Uint8Array(20);
    f.readSync(id3v2);

    let fb = new FancyBuffer(id3v2);

    const tag       = fb.readLenAsciiString(3);
    const major     = fb.readU8();
    const _minor    = fb.readU8();
    const _flags    = fb.readU8();
    const size      = (fb.readU8() << 7*3) | (fb.readU8() << 7*2) | (fb.readU8() << 7) | fb.readU8();

    if(tag != 'ID3') {
        f.seekSync(-128, Deno.SeekMode.End);
        const buf = Buffer.alloc(128);
        await f.read(buf);
        f.close();
        return getLegacy(new FancyBuffer(buf));
    }

    // TODO: handle extended header

    const frames = new Uint8Array(size);
    f.seekSync(0, Deno.SeekMode.Start);
    f.readSync(frames);
    f.close();

    if(major == 3) {
        fb = new FancyBuffer(frames);
        return getVersion3(fb, file);
    } else if(major == 4)  {
        fb = new FancyBuffer(frames);
        return getVersion4(fb, file);
    }

    return;
}