import { Keypress, readKeypress } from "https://deno.land/x/keypress@0.0.11/mod.ts";

import * as path from "node:path";

import { Player } from "./player.ts";
import { Renderer } from "./renderer.ts";
import * as utils from './utils.ts';
import { getFileID3, Tag } from "./id3.ts";

 const TEMP_PATH = `/home/nostalgia3/Music/`;
//const TEMP_PATH = `D:/Music/mp3/`;

import {
    Itui, color, Direction, SizeNode, ContentNode, ItuiStyle,
    padding_all, size_grow, size_static,
    padding,
} from './itui.ts';

type Track = {
    tag?:       Tag,
    file:       string
};

type Setting = {
    id: string, name: string,
    type: 'boolean',
    description: string,
    value: unknown
};

enum State {
    Normal,
    Lyrics,
    FullQueue
};

export function printSizeTree(s: Record<string, unknown>, indent = 0) {
    console.log(`${''.padStart(indent)}${s.id ?? 'unknown'}(x=${s.x}, y=${s.y}, w=${s.w}, h=${s.h}, type=${s.type}, children=${(s.children as Record<string,unknown>[])?.length})`);
    for(let i=0;i<((s.children as Record<string, unknown>[])?.length ?? 0);i++) {
        printSizeTree((s.children as Record<string, unknown>[])[i], indent + 2);
    }
}

// const ipc = new DiscordIPC('1331978897146908723');

// ipc.connect();

// ipc.setActivity({
//     details: '{title}', state: '{artists}', type: ActivityType.Listening,
//     assets: {
//         large_text: 'In {album}'
//     }
// });

// const t = await getFileID3('D:/Music/mp3/[Official] Celeste Original Soundtrack - 18 - Reach for the Summit [iDVM9KED46Q].mp3');

// const isrc = t?.extra.find((v)=>v.name=='TSRC');

// if(isrc != undefined) {
//     console.log(isrc.value as string);
//     await fetch(`https://musicbrainz.org/ws/2/isrc/${isrc.value as string}?fmt=json`);
// }

// setInterval(()=>{});

const ui = new Itui();

class App extends utils.TypedEventEmitter<{
    click: [number, number, number, boolean],
    scroll: [number, number, number],
    keypress: [Keypress],
    drag: [number, number, number, number, number],
    mouse_move: [number, number],
    music_start: [Track],
    music_resume: [Track],
    music_pause: [Track],
    music_end: [Track]
}> {
    protected rend: Renderer;
    protected size: { w: number, h: number };
    protected tracks: Track[];
    protected queue: Track[];
    protected trackSel: number;
    protected queueSel: number;
    protected trackOff: number;

    protected dragX: number;
    protected dragY: number;

    protected renderNow: boolean;
    protected activeTrack?: Track;

    protected player: Player;

    protected theme = {
        // const fillCharacter = '━';
        // const fillCharacter = '█';
        playbar_char:       '━',
        playbar_fillchar:   '━',
        playbar_color:      utils.grad([192,192,192]),
        playbar_fillcolor:  utils.grad([255,255,255]),
        playbar_thumbchar:  '*',

        playing_song_fg:    utils.grad([192, 192, 255]),
        selected_song_fg:   utils.grad([0, 0, 0]),
        selected_song_bg:   utils.grad([255,255,255]),

        // primary_fg:         utils.grad([255, 255, 255]),
        // secondary_fg:       utils.grad([192, 192, 192]),
        primary_fg: utils.grad(utils.parseHexColor(`#DFDFDF`)),
        secondary_fg: utils.grad(utils.parseHexColor(`#1ED760`)),
        // bg: color(`#232526`, `#414345`),
        bg: color([97, 67, 133], [81, 99, 149]), // Kashmir
        // bg: color(`#283048`, `#859398`),
        // [[238, 156, 167], [255, 221, 225]]    // Piglet
        // [[255, 95, 109], [255, 195, 113]]     // Sweet Morning
    };

    protected ui: ContentNode;
    protected nt: SizeNode;

    protected state: State;

    protected volume: number;

    constructor() {
        super();

        const { columns: w, rows: h } = Deno.consoleSize();
        this.size = { w, h };
        this.tracks = [];
        this.queue = [];
        this.queueSel = 0;
        this.trackSel = 0;
        this.trackOff = 0;

        // this.player.getVolume()
        this.volume = 1;

        this.state = State.Normal;

        this.dragX = 0;
        this.dragY = 0;

        this.renderNow = true;

        this.player = new Player();
        this.player.setVolume(this.volume*128);

        this.player.on('pos_update', (pos) => {
            if(Math.floor(pos) == Math.ceil(pos))
                this.drawScrubber();
        });

        this.player.on('pos_end', () => {
            this.playNextInQueue();
            this.render();
        });

        this.rend = new Renderer(this.size.w, this.size.h);

        this.ui = ui.panel({});
        this.updateUI();

        this.nt = ui.layout(this.size.w, this.size.h, 0, 0, this.ui);
    }

    updateUI() {
        const position = parseFloat(this.player.getPosition().toFixed(0));
        const minutesPlayed = (position - (position % 60))/60;
        const secondsPlayed = position % 60;

        const length = parseFloat(this.player.getTotalLength().toFixed(0));
        const totalSeconds = length % 60;
        const totalMinutes = (length - totalSeconds)/60;

        const playbar = ui.panel({
            w: size_grow(),
            h: size_static(3),
            padding: padding(1, 0, 1, 0),
            child_padding: 1,
        }, [
            ui.panel({
                w: size_static(20),
                h: size_static(1),
                child_padding: 1
            }, [
                ui.button({ bg: color('#FFF'), fg: color('#000'), w: size_static(4), h: size_static(1) }, `<<`, 'previous'),
                ui.button({ bg: color('#FFF'), fg: color('#000'), w: size_static(4), h: size_static(1) }, `|>`, 'play-pause'),
                ui.button({ bg: color('#FFF'), fg: color('#000'), w: size_static(4), h: size_static(1) }, `>>`, 'forwards'),
                ui.text({ fg: color('#FFF') }, `${Math.ceil(this.volume*100).toString().padStart(3)}%`)
            ], 'media-controls'),
            ui.text({ fg: color('#FFF') }, `${minutesPlayed}:${secondsPlayed.toString().padStart(2,'0')}`),
            ui.hprogress({ fg: color('#FFF'), bg: color('#888'), w: size_grow(), h: size_static(1), thin: true }, Math.floor(this.player.getPosition()), Math.floor(this.player.getTotalLength()), 'play'),
            ui.text({ fg: color('#FFF') }, `${totalMinutes}:${totalSeconds.toString().padStart(2,'0')}`),
        ], 'playbar');

        const trackStyle: Partial<ItuiStyle> = {
            fg: color('#FFF'),
            clickable: false
        };

        const queue = ui.panel({
            w: size_static(30),
            grow: 1,
            child_dir: Direction.Vertical,
            title: 'Queue'
        }, [
            ...this.queue.slice(this.queueSel-((this.queueSel==0)?0:1)).map((v,i)=>{
                return ui.text({ ...trackStyle, fg: color('#FFF'), w: size_static(28) }, ((i==((this.queueSel==0)?0:1))?'> ':'  ') + (v.tag?.title ?? v.file));
            })
        ], 'queue');

        switch(this.state) {
            case State.Lyrics: {
                this.ui = ui.panel({
                    child_dir: Direction.Vertical, bg: this.theme.bg,
                }, [ ui.panel({ title: 'Lyrics', padding: padding_all(1, true) }, [
                    ui.panel({ bg: color('#FFF'), grow: 1, child_dir: Direction.Vertical, centered: Direction.Horizontal }, [
                        ui.panel({ bg: color('#323'), h: size_static(3), w: size_static(6) })
                    ]),
                    ui.panel({ bg: color('#000'), grow: 3 }),
                ]), playbar ])
            break; }

            case State.Normal: {
                const titleMaxWidth = 40;
                const artistMaxWidth = 30;
                const albumMaxWidth = 30;

                let longestTrackTitle = 0;
                let longestArtist = 0;
                let longestAlbum = 0;

                for(let i=0;i<this.tracks.length;i++) {
                    if((this.tracks[i].tag?.title?.length ?? this.tracks[i].file.length) > longestTrackTitle) {
                        longestTrackTitle = (this.tracks[i].tag?.title?.length ?? this.tracks[i].file.length);
                    }
                    if(longestTrackTitle > titleMaxWidth) {
                        longestTrackTitle = titleMaxWidth;
                    }

                    if((this.tracks[i].tag?.artists?.join(', ') ?? '').length > longestArtist) {
                        longestArtist = (this.tracks[i].tag?.artists?.join(', ') ?? '').length;
                    }
                    if(longestArtist > artistMaxWidth) {
                        longestArtist = artistMaxWidth;
                    }

                    if((this.tracks[i].tag?.album ?? '').length > longestAlbum) {
                        longestAlbum = (this.tracks[i].tag?.artists?.join(', ') ?? '').length;
                    }
                    if(longestAlbum > albumMaxWidth) {
                        longestAlbum = albumMaxWidth;
                    }
                }

                this.ui = ui.panel({
                    child_dir: Direction.Vertical,
                    bg: this.theme.bg
                }, [
                    ui.panel({}, [
                        ui.panel({
                            child_dir: Direction.Horizontal,
                            title: 'Tracks'
                        }, [
                            ui.scrollPanel({
                                child_dir: Direction.Vertical
                            }, this.trackOff, [
                                ...this.tracks.map((v,i)=>{
                                    const fg = (i==this.trackSel)?color('#000'):color('#FFF');

                                    return ui.panel(
                                        { h: size_static(1), bg: (i==this.trackSel)?color('#FFF'):undefined, child_padding: 1 }, [
                                            ui.text({ ...trackStyle, w: size_static(longestTrackTitle), fg }, v.tag?.title ?? v.file),
                                            ui.text({ ...trackStyle, w: size_static(longestArtist), fg }, v.tag?.artists?.join(', ') ?? ''),
                                            ui.text({ ...trackStyle, w: size_grow(), fg }, v.tag?.album ?? '')
                                        ], `track::file>${v.file}`
                                    )
                                })
                            ], 'tracks'),
                        ]),
                        ui.panel({
                            w: size_static(30),
                            child_dir: Direction.Vertical
                        }, [
                            ui.panel({ padding: padding(0, 0, 1, 1, false), title: 'Active', child_dir: Direction.Vertical, child_padding: 1, grow: 1, h: size_static(18) }, [
                                ui.panel({
                                    centered: Direction.Horizontal,
                                    w: size_static(26),
                                    h: size_static(11),
                                    bg: color('#323232')
                                }, undefined, 'ImageTodo'),
                                ui.panel({
                                    child_dir: Direction.Vertical
                                }, [
                                    ui.text({
                                        fg: color(`#ffffff`),
                                    }, this.activeTrack ? (this.activeTrack.tag?.title ?? this.activeTrack.file) : `Title`, 'title'),
                                    ui.text({
                                        fg: color(`#808080`),
                                    }, this.activeTrack ? (this.activeTrack.tag?.artists?.join(', ') ?? '') : `Artists`, 'artist')
                                ], 'playing-now'),
                            ]),
                            queue,
                        ], 'SideBar')
                    ]),
                    playbar
                ], 'OuterContainer');
            break; }
        }
    }

    exit() {
        utils.disableMouse();
        utils.setAltBuffer(false);
        utils.showCursor();
        Deno.exit(0);
    }

    update() {
        this.renderNow = true;
    }

    async start() {
        const f = Deno.readDirSync(`${TEMP_PATH}`);

        for(const entry of f) {
            if(!entry.isFile) continue;
            if(path.extname(entry.name) != '.mp3') continue;
            const tags = await getFileID3(`${TEMP_PATH}/${entry.name}`);

            this.tracks.push({ file: entry.name, tag: tags });
            this.queue.push({ file: entry.name, tag: tags })
        }

        // this.tracks.sort((a,b)=>(a.title??a.file).length-(b.title??b.file).length);

        utils.enableMouse();
        utils.setAltBuffer(true);
        utils.hideCursor();

        let c = Deno.consoleSize();
        setInterval(()=>{
            const cur = Deno.consoleSize();
            if(cur.columns != c.columns || cur.rows != c.rows) {
                console.clear();
                this.render();
                c = cur;
            }
        }, 1);

        // Initialize the node table
        this.updateUI();
        this.nt = ui.layout(this.size.w, this.size.h, 0, 0, this.ui);

        this.render();
        
        for await(const keypress of readKeypress(Deno.stdin)) {
            if(keypress.ctrlKey && keypress.key == 'c') {
                this.exit();
            }

            const { columns: w, rows: h } = Deno.consoleSize();
            this.size = { w, h };
        
            const d = keypress.unicode.split('\\u').map((v)=>String.fromCharCode(parseInt('0x0'+v,16))).join('').substring(1);

            if(d[0] == '\x1b' && d[2] == '<') {
                // determine the type of packet
                const data = d.substring(3).split(';').map((v)=>parseInt(v));
                
                const button = data[0];
                const x = data[1];
                const y = data[2];
                const released = d.substring(d.length-1) == 'm';

                if(button == 35) {
                    // movement of the mouse
                    this.emit('mouse_move', x, y);
                } else if(button >= 0 && button <= 3) {
                    // mouse button click
                    this.emit('click', button, x, y, released);
                } else if(button == 64) {
                    // scroll up
                    this.emit('scroll', -1, x, y);
                } else if(button == 65) {
                    // scroll down
                    this.emit('scroll', 1, x, y);
                }
            } else {
                switch(keypress.key) {
                    case 'up':
                    case 'k':
                        this.trackUp();
                        break;
    
                    case 'down':
                    case 'j':
                        this.trackDown();
                        break;

                    case 'return':
                        this.playSelectedTrack();
                        this.renderNow = true;
                        break;
                    
                    case '[':
                    case '-':
                        this.volume = Math.max(this.volume - 0.05, 0);
                        this.player.setVolume(this.volume*128);
                        this.render();
                    break;

                    case '+':
                    case ']':
                        this.volume = Math.min(this.volume + 0.05, 128);
                        this.player.setVolume(this.volume*128);
                        this.render();
                    break;
                    
                    case 'space':
                        this.togglePlaying();
                    break;
    
                    default:
                        utils.bell();
                        break;
                }
            }

            if(this.renderNow) this.render();
            this.renderNow = false;
        }
    }

    renderNode(n: SizeNode) {
        const commands = ui.draw(n);
        for(const command of commands) {
            try {
                switch(command.type) {
                    case 'text': {
                        const comm = command;
                        this.rend.text(comm.x, comm.y, comm.text, comm.fg, comm.bg);
                    break; }
                        
                    case 'rect': {
                        const comm = command;
                        if(comm.title)
                            this.rend.box(comm.x, comm.y, comm.w, comm.h, comm.title, color('#FFF'), comm.bg);
                        else
                            this.rend.rect(comm.x, comm.y, comm.w, comm.h, comm.bg);
                    break; }

                    case 'vline': {
                        const comm = command;
                        this.rend.hline(comm.x, comm.y, comm.w, comm.fg ?? color('#000'), comm.bg);
                    break; }
                }
            } catch(e) {
                console.log(command);
                throw e;
            }
        }

        this.rend.draw();
    }

    render() {
        const { columns: w, rows: h } = Deno.consoleSize();
        this.size = { w, h };
        this.rend.resize(w, h);

        this.updateUI();
        this.nt = ui.layout(w, h, 0, 0, this.ui);
        this.renderNode(this.nt);
    }

    drawScrubber() {
        this.updateUI();
        this.nt = ui.layout(this.size.w, this.size.h, 0, 0, this.ui);
        const playbar = ui.getElementById(this.nt, 'playbar');
        if(!playbar) return;
        this.renderNode(playbar);
    }

    drawTracks() {
        this.updateUI();
        this.nt = ui.layout(this.size.w, this.size.h, 0, 0, this.ui);
        const tracks = ui.getElementById(this.nt, 'tracks');
        if(!tracks) return;
        this.renderNode(tracks);
    }

    handleClick(x: number, y: number) {
        const el = ui.click(this.nt, x, y);
        if(!el) return;
        if(!el.id) return;

        switch(el.id) {
            case 'play-pause':
                this.togglePlaying();
                this.render();
            break;

            case 'previous':
                if(this.player.getPosition() < 2)
                    this.playPreviousInQueue();
                else
                    this.playCurrentInQueue();
                    this.render();
            break;

            case 'forwards':
                this.playNextInQueue();
                this.render();
            break;
        }

        if(el.id.startsWith('track::file>')) {
            this.selectWithOffset(y-2);
        }
    }

    handleScroll(x: number, y: number, count: number) {
        const tracks = ui.getElementById(this.nt, 'tracks');
        if(!tracks) return;
        if(ui.inRange(tracks, x, y)) {
            if(count > 0) app.scrollDown(5);
            else app.scrollUp(5);
            this.render();
        }
    }

    trackUp() {
        if((this.trackSel) <= 0) {
            // utils.bell();
        } else if((this.trackSel-this.trackOff) > 0) {
            this.trackSel--;
            // this.render();
            this.drawTracks();
        } else {
            this.trackSel--;
            this.trackOff--;
            this.drawTracks();
        }
    }

    trackDown() {
        if(this.trackSel > this.tracks.length-2) {
            // utils.bell();
        } else if((this.trackSel-this.trackOff) < (ui.getElementById(this.nt, 'tracks')?.h ?? 1)-1) {
            this.trackSel++;
            this.drawTracks();
        } else {
            this.trackOff++; this.trackSel++;
            this.drawTracks();
        }
    }

    scrollUp(c=1) {
        for(let i=0;i<c;i++) {
            if(this.trackOff <= 0) {
                break;
            } else {
                this.trackOff--;
            }
        }
    }

    scrollDown(c = 1) {
        for(let i=0;i<c;i++) {
            if(this.trackOff > this.tracks.length-(ui.getElementById(this.nt, 'tracks')?.h ?? 1)-1) {
                utils.bell();
                break;
            } else {
                this.trackOff++;
            }
        }
    }

    playSelectedTrack() {
        this.player.loadFile(path.join(TEMP_PATH, this.tracks[this.trackSel].file));
        this.player.play(0);
        this.activeTrack = this.tracks[this.trackSel];
        this.queueSel = this.trackSel;
    }

    playCurrentInQueue() {
        if(!this.activeTrack) return;
        this.player.loadFile(path.join(TEMP_PATH, this.activeTrack.file));
        this.player.play(0);
        this.activeTrack = this.queue[this.queueSel];
    }

    playPreviousInQueue() {
        // if (!this.queueSel) this.queueSel = this.trackSel;
        //If this isn't a if else we will skip the first song if we loop around
        if (this.queueSel == 0) {
            this.queueSel = this.queue.length-1;
        } else {
            this.queueSel--;
        }

        this.player.loadFile(path.join(TEMP_PATH, this.queue[this.queueSel].file));
        this.player.play(0);
        this.activeTrack = this.queue[this.queueSel];
    }

    playNextInQueue() {
        // if (!this.queueSel) this.queueSel = this.trackSel;
        //If this isn't a if else we will skip the first song if we loop around
        if (this.queueSel >= this.queue.length-1) {
            this.queueSel = 0;
        } else {
            this.queueSel++;
        }

        this.player.loadFile(path.join(TEMP_PATH, this.queue[this.queueSel].file));
        this.player.play(0);
        this.activeTrack = this.queue[this.queueSel];
    }

    selectWithOffset(x: number) {
        if(this.tracks[this.trackOff + x]) {
            if(this.trackSel == this.trackOff + x) {
                this.playSelectedTrack();
            } else {
                this.trackSel = this.trackOff + x;
            }
            this.render();
        } else utils.bell();
    }

    /**
     * Toggle whether the audio is playing or not
     */
    togglePlaying() {
        if(this.player.isPaused())
            this.player.resume();
        else
            this.player.pause();

        this.drawScrubber();
    }
}

import process from 'node:process';
process.on('beforeExit', () => {
    utils.disableMouse();
    utils.setAltBuffer(false);
    utils.showCursor();
});

const app = new App();

app.on('click', (button, x, y, down) => {
    if(!down) return;

    if(button == 0)
        app.handleClick(x, y);
});

app.on('scroll', (count, x, y) => {
    app.handleScroll(x, y, count);
});

app.start();
