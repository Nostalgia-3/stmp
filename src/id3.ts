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
    title: string,
    artist: string,
    album: string,
    year: string,
    comment: string,
    genre: Genre
};

function getVersion3(fb: FancyBuffer) {
    fb.skip(10);

    while(1) {
        const tag   = fb.readLenAsciiString(4);
        const size  = fb.readU32BE();
        const _flags = fb.readU16BE();

        if(size == 0) break;

        switch(tag) {
            case 'TYER':
                console.log(`Year\t\t${fb.readLenUTF8String(size)}`);
            break;

            case 'TENC':
                console.log(`Encoded by\t${fb.readLenUTF8String(size)}`);
            break;

            case 'TIT2':
                console.log(`Name\t\t${fb.readLenUTF8String(size)}`);
            break;

            case 'TIT3':
                console.log(`Subtitle\t${fb.readLenUTF8String(size)}`);
            break;

            default:
                console.log(tag);
                fb.skip(size);
            break;
        }
    }
}

function getVersion4(fb: FancyBuffer) {
    fb.skip(10);

    console.log(`\x1b[31mTitle\x1b[0m\t\t\x1b[31mValue\x1b[0m`);
    while(1) {
        const tag   = fb.readLenAsciiString(4);
        const size  = (fb.readU8() << 7*3) | (fb.readU8() << 7*2) | (fb.readU8() << 7) | fb.readU8();
        const _flags = fb.readU16BE();

        if(size == 0) break;

        switch(tag) {
            case 'TYER':
                console.log(`\x1b[36mYear\x1b[0m\t\t${fb.readLenUTF8String(size)}`);
            break;

            case 'TENC':
                console.log(`\x1b[36mEncoded by\x1b[0m\t${fb.readLenUTF8String(size)}`);
            break;

            case 'TIT2':
                console.log(`\x1b[36mName\x1b[0m\t\t${fb.readLenUTF8String(size)}`);
            break;

            case 'TIT3':
                console.log(`\x1b[33mSubtitle\x1b[0m\t${fb.readLenUTF8String(size)}`);
            break;

            default:
                console.log(`\x1b[36m${tag}\x1b[0m\t\tsize=${size}`);
                fb.skip(size);
            break;
        }
    }
}

function getLegacy(fb: FancyBuffer) {
    const b = fb.readLenAsciiString(3);
    if(b != 'TAG')
        return;

    return {
        title:  fb.readLenUTF8String(30).split('\0')[0],
        artist: fb.readLenUTF8String(30).split('\0')[0],
        album:  fb.readLenUTF8String(30).split('\0')[0],
        year:   fb.readLenUTF8String(4),
        comment:fb.readLenUTF8String(30).split('\0')[0],
        genre:  fb.readU8()
    };
}

export async function getFileID3(file: string) {
    // This lets me not load the entire file, which *should*
    // make it faster (I think, anyways)
    const f = await Deno.open(file, { read: true, write: false });
    f.seekSync(0, Deno.SeekMode.Start);

    const id3v2 = new Uint8Array(20);
    f.readSync(id3v2);

    let fb = new FancyBuffer(id3v2);

    const tag       = fb.readLenAsciiString(3);
    const major     = fb.readU8();
    const minor     = fb.readU8();
    const flags     = fb.readU8();
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

    fb = new FancyBuffer(frames);

    if(major == 3) {
        return getVersion3(fb);
    } else if(major == 4)  {
        return getVersion4(fb);
    }

    return;
}