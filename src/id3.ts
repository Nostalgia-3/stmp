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

export async function getFileID3(file: string): Promise<Tag | undefined> {
    // This lets me not load the entire file, which *should*
    // make it faster (I think, anyways)
    const f = await Deno.open(file, { read: true, write: false });
    f.seekSync(-128, Deno.SeekMode.End);
    const buf = Buffer.alloc(128);
    const read = await f.read(buf);
    f.close();

    if(read != 128) return;

    const fb = new FancyBuffer(buf);

    // Check if it has an ID3v1 tag
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