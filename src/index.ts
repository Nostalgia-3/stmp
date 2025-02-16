import { Keypress, readKeypress } from "https://deno.land/x/keypress@0.0.11/mod.ts";

import * as path from "node:path";

import {
    Itui, color, Direction, SizeNode, ContentNode, ItuiStyle,
    Padding, Size,
} from './itui.ts';
import { Player } from "./player.ts";
import { Renderer } from "./renderer.ts";
import * as utils from './utils.ts';
import { getFileID3, Tag } from "./id3.ts";

// const `${this.settings.getString('music_path')}` = `/home/nostalgia3/Music/`;
// const `${this.settings.getString('music_path')}` = `D:/Music/mp3/`;

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
    FullQueue,
    Settings
};

export function printSizeTree(s: Record<string, unknown>, indent = 0) {
    console.log(`${''.padStart(indent)}${s.id ?? 'unknown'}(x=${s.x}, y=${s.y}, w=${s.w}, h=${s.h}, type=${s.type}, children=${(s.children as Record<string,unknown>[])?.length})`);
    for(let i=0;i<((s.children as Record<string, unknown>[])?.length ?? 0);i++) {
        printSizeTree((s.children as Record<string, unknown>[])[i], indent + 2);
    }
}

const ui = new Itui();

function removeAnsiEscapeCodes(str: string) {
    // deno-lint-ignore no-control-regex
    return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><~]/g, '');
};

class App extends utils.TypedEventEmitter<{
    click: [number, number, number, boolean],
    scroll: [number, number, number],
    keypress: [Keypress],
    drag: [number, [number, number], [number, number]],
    mouse_move: [number, number],
    music_start: [Track],
    music_resume: [Track],
    music_pause: [Track],
    music_end: [Track]
}> {
    protected rend: Renderer;
    protected size: { w: number, h: number };
    protected tracks: Track[];
    protected trackSel: number;
    protected trackOff: number; // Used for rendering
    protected queue: Track[];
    protected queueSel: number;

    protected dragX: number;
    protected dragY: number;

    protected renderNow: boolean;
    protected activeTrack?: Track;

    protected player: Player;
    protected settings: SettingsManager;

    protected ui: ContentNode;
    protected nt: SizeNode;

    protected state: State;
    protected volume: number;

    protected theme = {
        playbar_char:       '━', // ━
        playbar_fillchar:   '━', // █
        playbar_color:      color(`#CCC`),
        playbar_fillcolor:  color(`#FFF`),
        playbar_thumbchar:  '*',

        playing_song_fg:    color(`#CCF`),
        selected_song_fg:   color(`#000`),
        selected_song_bg:   color(`#FFF`),

        primary_fg:         color(`#DFDFDF`),
        secondary_fg:       color(`#1ED760`),
        // bg: color([97, 67, 133], [81, 99, 149]), // Kashmir
        bg: color(`#232526`, `#414345`), // Grey thing
        // bg: color(`#283048`, `#859398`),
        // bg: color([238, 156, 167], [255, 221, 225])    // Piglet
        // bg: color([255, 95, 109], [255, 195, 113])     // Sweet Morning
    };

    protected settingsScroll: number;

    constructor() {
        super();

        const { columns: w, rows: h } = Deno.consoleSize();
        this.size = { w, h };
        this.tracks = [];
        this.queue = [];
        this.queueSel = 0;
        this.trackSel = 0;
        this.trackOff = 0;

        this.settingsScroll = 0;

        this.settings = new SettingsManager('.config.json', {
            music_path: '',
            transparency: false
        });

        this.settings.setBool('transparency', true);

        if(this.settings.getString('music_path') == '') {
            this.settings.setString('music_path', prompt(`Where is your music?`) ?? '');
        }

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
            w: Size.grow(),
            h: Size.static(3),
            padding: Padding.all(1, 0, 1, 0),
            child_padding: 1,
        }, [
            ui.panel({
                w: Size.static(20),
                h: Size.static(1),
                child_padding: 1
            }, [
                ui.button({ bg: color('#FFF'), fg: color('#000'), w: Size.static(4), h: Size.static(1) }, `<<`, 'previous'),
                ui.button({ bg: color('#FFF'), fg: color('#000'), w: Size.static(4), h: Size.static(1) }, `|>`, 'play-pause'),
                ui.button({ bg: color('#FFF'), fg: color('#000'), w: Size.static(4), h: Size.static(1) }, `>>`, 'forwards'),
                ui.text({ fg: color('#FFF') }, `${Math.ceil(this.volume*100).toString().padStart(3)}%`)
            ], 'media-controls'),
            ui.text({ fg: color('#FFF') }, `${minutesPlayed}:${secondsPlayed.toString().padStart(2,'0')}`),
            ui.hprogress({ fg: color('#FFF'), bg: color('#888'), h: Size.static(1), thin: true }, Math.floor(this.player.getPosition()), Math.floor(this.player.getTotalLength()), 'play'),
            ui.text({ fg: color('#FFF') }, `${totalMinutes}:${totalSeconds.toString().padStart(2,'0')}`),
            ui.panel({ w: Size.static(9) }, [ ui.button({ fg: color('#000'), bg: color('#FFF'), h: Size.static(1) }, 'Settings', 'open-settings') ])
        ], 'playbar');

        const trackStyle: Partial<ItuiStyle> = {
            fg: color('#FFF'),
            clickable: false
        };

        const queue = ui.panel({
            w: Size.static(30),
            grow: 1,
            child_dir: Direction.Vertical,
            title: 'Queue'
        }, [
            ...this.queue.slice(this.queueSel-((this.queueSel==0)?0:1)).map((v,i)=>{
                return ui.text({ ...trackStyle, fg: color('#FFF'), w: Size.static(28) }, ((i==((this.queueSel==0)?0:1))?'> ':'  ') + (v.tag?.title ?? v.file));
            })
        ], 'queue');

        switch(this.state) {
            case State.Lyrics: {
                this.ui = ui.panel({
                    child_dir: Direction.Vertical, bg: this.theme.bg,
                }, [ ui.panel({ title: 'Lyrics', padding: Padding.same(1, true) }, [
                    ui.panel({ bg: color('#FFF'), grow: 1, child_dir: Direction.Vertical, centered: Direction.Horizontal }, [
                        ui.panel({ bg: color('#323'), h: Size.static(3), w: Size.static(6) })
                    ]),
                    ui.panel({ bg: color('#000'), grow: 3 }),
                ]), playbar ]);
            break; }

            case State.Settings: {
                this.ui = ui.panel({
                    bg: color('#222'),
                    z: 2,
                    child_dir: Direction.Vertical
                }, [
                    ui.panel({ bg: color('#444'), h: Size.static(1), z: 1 }, [
                        ui.text({}, 'Settings', 'title-settings'),
                        ui.panel({}),
                        ui.button({ fg: color('#000'), bg: color('#F33') }, 'X', 'close-settings')
                    ], 'settings-controls'),
                    ui.scrollPanel({ child_dir: Direction.Vertical, padding: Padding.same(1) }, this.settingsScroll, [
                        ...Object.keys(this.settings.c).map((v, i)=>{
                            return ui.panel({ fg: color('#fff'), h: Size.static(1), bg: color((i%2) ? '#666' : '#555') }, [ui.text({}, `${v} ${typeof(this.settings.c[v])}`), ui.panel({}), ui.text({}, `(${this.settings.c[v]})`) ])
                        })
                    ])
                ]);
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
                                child_dir: Direction.Vertical,
                                fg: color('#FFF')
                            }, this.trackOff, [
                                ...this.tracks.map((v,i)=>{
                                    const fg = (i==this.trackSel)? this.theme.selected_song_fg : this.theme.primary_fg;

                                    return ui.panel(
                                        { h: Size.static(1), bg: (i==this.trackSel)?this.theme.selected_song_bg:undefined, child_padding: 1 }, [
                                            ui.text({ ...trackStyle, w: Size.static(longestTrackTitle), fg }, v.tag?.title ?? v.file),
                                            ui.text({ ...trackStyle, w: Size.static(longestArtist), fg }, v.tag?.artists?.join(', ') ?? ''),
                                            ui.text({ ...trackStyle, w: Size.grow(), fg }, v.tag?.album ?? '')
                                        ], `track::file>${v.file}`
                                    )
                                })
                            ], 'tracks'),
                        ]),
                        ui.panel({
                            w: Size.static(30),
                            child_dir: Direction.Vertical
                        }, [
                            ui.panel({ padding: Padding.all(0, 0, 1, 1, false), title: 'Active', child_dir: Direction.Vertical, child_padding: 1, grow: 1, h: Size.static(18) }, [
                                ui.panel({
                                    centered: Direction.Horizontal,
                                    w: Size.static(26),
                                    h: Size.static(11),
                                    bg: color('#323232')
                                }, undefined, 'ImageTodo'),
                                ui.panel({
                                    child_dir: Direction.Vertical
                                }, [
                                    ui.text({
                                        fg: this.theme.primary_fg,
                                    }, this.activeTrack ? (this.activeTrack.tag?.title ?? this.activeTrack.file) : `Title`, 'title'),
                                    ui.text({
                                        fg: this.theme.secondary_fg,
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
        app.settings.save();
        Deno.exit(0);
    }

    update() {
        this.renderNow = true;
    }

    async start() {
        const f = Deno.readDirSync(`${this.settings.getString('music_path')}`);

        for(const entry of f) {
            if(!entry.isFile) continue;
            if(path.extname(entry.name) != '.mp3') continue;
            const tags = await getFileID3(`${this.settings.getString('music_path')}/${entry.name}`);

            this.tracks.push({ file: entry.name, tag: tags });
            this.queue.push({ file: entry.name, tag: tags })
        }

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
                    if(!released) {
                        this.dragX = x;
                        this.dragY = y;
                    } else {
                        this.emit('drag', button, [this.dragX, this.dragY], [x, y])
                    }
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

    /**
     * Render a node tree based on the node
     * @param n The root node in a node tree
     */
    renderNode(n: SizeNode) {
        const commands = ui.draw(n).sort((a,b)=>(a.z-b.z));
        for(const command of commands) {
            try {
                const before = this.rend.s.length;
                switch(command.type) {
                    case 'text': {
                        const comm = command;
                        this.rend.text(comm.x, comm.y, comm.text, comm.fg, comm.bg);

                        const nonAnsi = removeAnsiEscapeCodes(this.rend.s.slice(before)).length;
                        const totalCharacters = this.rend.s.length-before;
                        const percentAnsi = 100 - (nonAnsi / totalCharacters * 100);

                        // console.log(
                        //     `text (${command.x}, ${command.y}, ${comm.text.length})`.padEnd(25),
                        //    isNaN(percentAnsi) ? '0% ansi' : (percentAnsi.toFixed(2) + '% ansi'),
                        //     `\t${totalCharacters-nonAnsi}/${totalCharacters} ansi`
                        // );
                    break; }

                    case 'rect': {
                        const comm = command;
                        if(comm.title)
                            this.rend.box(comm.x, comm.y, comm.w, comm.h, comm.title, color('#FFF'), comm.bg);
                        else
                            this.rend.rect(comm.x, comm.y, comm.w, comm.h, comm.bg);

                        const notAnsi = removeAnsiEscapeCodes(this.rend.s.slice(before)).length;
                        const totalCharacters = this.rend.s.length-before;
                        const percentAnsi = 100 - (notAnsi/totalCharacters * 100);

                        // console.log(
                        //     `${comm.title ? 'box  ' : 'rect '}(${command.x}, ${command.y}, ${command.w}, ${command.h})`.padEnd(25),
                        //     isNaN(percentAnsi) ? '0% ansi' : (percentAnsi.toFixed(2) + '% ansi'),
                        //     `\t${totalCharacters-notAnsi}/${totalCharacters} ansi`
                        // );
                    break; }

                    case 'vline': {
                        const comm = command;
                        this.rend.hline(comm.x, comm.y, comm.w, comm.fg ?? color('#000'), comm.bg);
                        const notAnsi = removeAnsiEscapeCodes(this.rend.s.slice(before)).length;
                        const totalCharacters = this.rend.s.length-before;
                        const percentAnsi = 100 - (notAnsi/totalCharacters * 100);

                        // console.log(
                        //     `vline(${command.x}, ${command.y}, ${command.w})`.padEnd(25),
                        //     isNaN(percentAnsi) ? '0% ansi' : (percentAnsi.toFixed(2) + '% ansi'),
                        //     `\t${totalCharacters-notAnsi}/${totalCharacters} ansi`
                        // );
                    break; }
                }
            } catch(e) {
                console.log(command);
                this.exit();
            }
        }

        const notAnsi = removeAnsiEscapeCodes(this.rend.s).length;
        const totalCharacters = this.rend.s.length;
        const percentAnsi = 100 - (notAnsi/totalCharacters * 100);

        // console.log(`total % ansi = ${percentAnsi.toFixed(2)}%, whitespace% = ${(100 - this.rend.s.replaceAll(' ', '').length/totalCharacters * 100).toFixed(2)}%`);
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
        this.render();
        // this.updateUI();
        // this.nt = ui.layout(this.size.w, this.size.h, 0, 0, this.ui);
        // const tracks = ui.getElementById(this.nt, 'tracks');
        // if(!tracks) return;
        // tracks.style.bg = [
        //     utils.interpolate(this.theme.bg[0], this.theme.bg[1], tracks.y/this.size.h),
        //     utils.interpolate(this.theme.bg[0], this.theme.bg[1], tracks.h/this.size.h)
        // ];
        // this.renderNode(tracks);
    }

    drawSettings() {
        this.render();
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

            case 'close-settings':
                this.state = State.Normal;
                this.render();
            break;

            case 'open-settings':
                this.state = State.Settings;
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
            this.drawTracks();
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
        this.player.loadFile(path.join(`${this.settings.getString('music_path')}`, this.tracks[this.trackSel].file));
        this.player.play(0);
        this.activeTrack = this.tracks[this.trackSel];
        this.queueSel = this.trackSel;
    }

    playCurrentInQueue() {
        if(!this.activeTrack) return;
        this.player.loadFile(path.join(`${this.settings.getString('music_path')}`, this.activeTrack.file));
        this.player.play(0);
        this.activeTrack = this.queue[this.queueSel];
    }

    playPreviousInQueue() {
        if(this.queueSel == 0) {
            this.queueSel = this.queue.length-1;
        } else {
            this.queueSel--;
        }

        this.player.loadFile(path.join(`${this.settings.getString('music_path')}`, this.queue[this.queueSel].file));
        this.player.play(0);
        this.activeTrack = this.queue[this.queueSel];
    }

    playNextInQueue() {
        if(this.queueSel >= this.queue.length-1) {
            this.queueSel = 0;
        } else {
            this.queueSel++;
        }

        this.player.loadFile(path.join(`${this.settings.getString('music_path')}`, this.queue[this.queueSel].file));
        this.player.play(0);
        this.activeTrack = this.queue[this.queueSel];
    }

    selectWithOffset(x: number) {
        if(this.tracks[this.trackOff + x]) {
            if(this.trackSel == this.trackOff + x) {
                // Implement a double-click instead of this
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
import { SettingsManager } from "./settings.ts";
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