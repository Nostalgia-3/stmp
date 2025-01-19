import { getLibrary, TypedEventEmitter } from "./utils.ts";

let sdl2: Deno.StaticForeignLibraryInterface<{
    readonly SDL_Init: {
        readonly parameters: readonly ["u32"];
        readonly result: "i32";
    };
}>;

let mixer: Deno.StaticForeignLibraryInterface<{
    Mix_OpenAudio:          { parameters: ['i32', 'u16', 'i32', 'i32'], result: 'i32' },
    Mix_VolumeMusic:        { parameters: ['i32'], result: 'i32' }, // Volume (0 -> MIX_MAX_VOLUME)
    Mix_LoadMUS:            { parameters: ['buffer'], result: 'pointer' },
    Mix_PlayMusic:          { parameters: ['pointer', 'i32'], result: 'i32' },
    Mix_FreeMusic:          { parameters: ['pointer'], result: 'void' },
    Mix_PauseMusic:         { parameters: [], result: 'void' },
    Mix_ResumeMusic:        { parameters: [], result: 'void' },
    Mix_SetMusicPosition:   { parameters: ['f64'], result: 'i32' },
    Mix_GetMusicPosition:   { parameters: ['pointer'], result: 'f64' },
    Mix_MusicDuration:      { parameters: ['pointer'], result: 'f64' }
}>;

try {
    const { symbols } = Deno.dlopen(getLibrary('SDL2'), {
        SDL_Init: {
            parameters: ['u32'],
            result: 'i32'
        }
    });
    sdl2 = symbols;
} catch {
    console.error(`Failed to find ${getLibrary('SDL2')}; make sure it's installed`);
    Deno.exit();
}

try {
    const { symbols } = Deno.dlopen(getLibrary('SDL2_mixer'), {
        Mix_OpenAudio:          { parameters: ['i32', 'u16', 'i32', 'i32'], result: 'i32' },
        Mix_VolumeMusic:        { parameters: ['i32'], result: 'i32' }, // Volume (0 -> MIX_MAX_VOLUME)
        Mix_LoadMUS:            { parameters: ['buffer'], result: 'pointer' },
        Mix_PlayMusic:          { parameters: ['pointer', 'i32'], result: 'i32' },
        Mix_FreeMusic:          { parameters: ['pointer'], result: 'void' },
        Mix_PauseMusic:         { parameters: [], result: 'void' },
        Mix_ResumeMusic:        { parameters: [], result: 'void' },
        Mix_SetMusicPosition:   { parameters: ['f64'], result: 'i32' },
        Mix_GetMusicPosition:   { parameters: ['pointer'], result: 'f64' },
        Mix_MusicDuration:      { parameters: ['pointer'], result: 'f64' }
    });
    mixer = symbols;
} catch {
    console.error(`Failed to find ${getLibrary('SDL2_mixer')}; make sure it's installed`);
    Deno.exit();
}

export function asCString(str: string): Uint8Array {
    return new TextEncoder().encode(`${str}\0`);
}

/**
 * An abstracted music player.
 */
export class Player extends TypedEventEmitter<{
    pos_update: [number]
}> {
    protected paused: boolean;
    protected loaded: boolean;
    protected music: Deno.PointerValue;
    protected int: number;
    protected prevPosition: number;

    constructor() {
        super();
        this.loaded = false;
        this.music = null;
        this.prevPosition = 0;
        this.paused = false;
        this.int = setInterval(() => {
            if(this.getPosition() != this.prevPosition) {
                this.emit('pos_update', this.getPosition());

                this.prevPosition = this.getPosition();
            }
        }, 5);

        // initialize audio
        if(sdl2.SDL_Init(0x10) < 0) {
            throw 'Failed to initialize SDL audio';
        }

        // 22050Hz, signed 16 bit audio, two channels, 640 sample frames
        mixer.Mix_OpenAudio(48000, 0x8010, 2, 640);
    }

    loadFile(file: string) {
        if(this.loaded) {
            mixer.Mix_FreeMusic(this.music);
        }

        this.music = mixer.Mix_LoadMUS(asCString(file));
        this.loaded = true;
    }

    /**
     * Set the volume of the loaded file
     * @param v A value from 0 to 1
     */
    setVolume(v: number) {
        mixer.Mix_VolumeMusic(Math.floor(Math.max(Math.min(v, 1.0), 0)*128));
    }

    getVolume() {
        return mixer.Mix_VolumeMusic(-1)/128;
    }

    setPosition(seconds: number) {
        mixer.Mix_SetMusicPosition(seconds);
    }

    getPosition() {
        if(!this.loaded) return 0.0;
        return mixer.Mix_GetMusicPosition(this.music);
    }

    getTotalLength() {
        if(!this.loaded) return 0.0;
        return mixer.Mix_MusicDuration(this.music);
    }

    play(loops = 0) {
        if(!this.loaded) return;

        mixer.Mix_PlayMusic(this.music, loops);
        this.paused = false;
    }

    isPaused() {
        return this.paused;
    }

    resume() {
        if(!this.loaded) return;
        mixer.Mix_ResumeMusic(); // Resume all channels
        this.paused = false;
    }

    pause() {
        if(!this.loaded) return;
        mixer.Mix_PauseMusic(); // Pause all channels
        this.paused = true;
    }
}
