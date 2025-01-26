import { Keypress, readKeypress } from "https://deno.land/x/keypress@0.0.11/mod.ts";

import * as path from "node:path";

import { Player } from "./player.ts";
import { Renderer } from "./renderer.ts";
import * as utils from './utils.ts';
import { getFileID3, Tag } from "./id3.ts";

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

// const TEMP_PATH = `/home/nostalgia3/Music/`;
const TEMP_PATH = `D:/Music/mp3/`;

class App extends utils.TypedEventEmitter<{
    click: [number, number, number, boolean],
    scroll: [number, number, number],
    keypress: [Keypress],
    drag: [number, number, number, number, number],
    mouse_move: [number, number]
}> {
    protected rend: Renderer;
    protected size: { w: number, h: number };
    protected tracks: Track[];
    protected trackSel: number;
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
        bg: [
            utils.parseHexColor(`#232526`),
            utils.parseHexColor(`#414345`),
        ]
        // bg:                 [[97, 67, 133], [81, 99, 149]] // Kashmir
        // bg:                 [utils.parseHexColor(`#283048`), utils.parseHexColor(`#859398`)]
        // [[238, 156, 167], [255, 221, 225]]    // Piglet
        // [[255, 95, 109], [255, 195, 113]]     // Sweet Morning
    };

    protected ui = {
        titleMaxWidth:      50, // Maximum title width

        playingNowWidth:    30,
        bottomBarWidth:     -1,
        bottomBarHeight:    4,
        trackWidth:         -1,
        trackHeight:        -1,
        playingNowHeight:   -1,

        settingsWidth:      75,
        settingsHeight:     20,

        ...this.theme
    };

    protected settings: Setting[] = [
        {
            id: 'test',
            name: `Example Setting`,
            type: 'boolean',
            description: `This is an example setting.`,
            value: false,
        },
    ];

    constructor() {
        super();

        const { columns: w, rows: h } = Deno.consoleSize();
        this.size = { w, h };
        this.tracks = [];
        this.trackSel = 0;
        this.trackOff = 0;

        this.dragX = 0;
        this.dragY = 0;

        this.renderNow = true;

        this.player = new Player();

        this.player.on('pos_update', () => {
            this.drawScrubber();
        });

        this.rend = new Renderer(this.size.w, this.size.h);
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
                        this.drawTracks();
                        break;
    
                    case 'down':
                    case 'j':
                        this.trackDown();
                        this.drawTracks();
                        break;

                    case 'return':
                        this.playAt();
                        break;
                    
                    case 'space':
                        this.toggle();
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

    render() {
        const { columns: w, rows: h } = Deno.consoleSize();
        this.size = { w, h };
        this.rend.resize(w, h);

        this.ui.bottomBarWidth  = w;
        this.ui.bottomBarHeight = 4;
        this.ui.trackWidth      = w-this.ui.playingNowWidth;
        this.ui.trackHeight     = h-this.ui.bottomBarHeight;
        this.ui.playingNowHeight= h-this.ui.bottomBarHeight;
        
        this.rend.clear(this.ui.bg as utils.Gradient);

        if(w < this.ui.playingNowWidth) {
            // draw smaller UI
        } else {
            this.drawTracks(false);
            this.drawScrubber(false);
            this.drawMediaControls(false);
            this.drawSideInfo(false);
            // this.drawSettings(false);
        }

        this.rend.draw();
    }

    drawTracks(flush = true) {
        const pfg = this.ui.primary_fg;
        const sfg = this.ui.secondary_fg;

        if(flush) {
            this.rend.rect(
                0, 0, this.ui.trackWidth, this.ui.trackHeight,
                [this.ui.bg[0] as utils.RGB, utils.interpolate(
                    this.ui.bg[0] as utils.RGB,
                    this.ui.bg[1] as utils.RGB,
                    (this.ui.trackHeight)/this.size.h
                )]
            );
        }

        this.rend.box(0, 0, this.ui.trackWidth, this.ui.trackHeight, 'Tracks', pfg);

        if(this.tracks.length == 0) {
            if(flush) this.rend.draw();
            return;
	    }

        // This is "slow", but unless the track list is absolutely massive,
        // it should be fine
        let longestTrackTitle = 0;
        for(let i=0;i<this.tracks.length;i++) {
            if((this.tracks[i].tag?.title?.length ?? this.tracks[i].file.length) > longestTrackTitle) {
                longestTrackTitle = (this.tracks[i].tag?.title?.length ?? this.tracks[i].file.length);
            }
            if(longestTrackTitle > this.ui.titleMaxWidth) {
                longestTrackTitle = this.ui.titleMaxWidth;
                break;
            }
        }

        for(let i=0;i<this.ui.trackHeight-2;i++) {
            if(this.tracks[this.trackOff+i] == undefined) {
                break;
            }

            const track     = this.tracks[this.trackOff+i];

            const selected  = this.trackSel == (i+this.trackOff);
            const fore      = (track.file == this.activeTrack?.file)
                ? this.ui.playing_song_fg
                : (selected ? this.ui.selected_song_fg : pfg);

            if(selected) this.rend.rect(1, i+1, this.ui.trackWidth-3, 1, this.ui.selected_song_bg);
            this.rend.text(
                1, i+1,
                ((track?.tag?.title ?? utils.filename(track.file))
                    .slice(0, this.ui.titleMaxWidth)
                    .padEnd(longestTrackTitle+1) +
                (track.tag?.artists?.join(', ') ?? '')).slice(0, this.ui.trackWidth-2),
                fore, undefined
            );
        }

        // Track scrubber
        if(this.tracks.length < this.ui.trackHeight-2) {
            this.rend.vline(this.ui.trackWidth-2, 1, this.ui.trackHeight-2, pfg, undefined, '▐');
        } else {
            const percentScrolled = (this.trackOff)/(this.tracks.length);
            const size = Math.floor((this.ui.trackHeight-2)/this.tracks.length*(this.ui.trackHeight-2));
            const offset = Math.ceil((this.ui.trackHeight-2) * percentScrolled);
            this.rend.vline(this.ui.trackWidth-2, 1, this.ui.trackHeight-2, sfg, undefined, '▐');
            this.rend.vline(this.ui.trackWidth-2, 1+offset, size, pfg, undefined, '▐');
        }

        if(flush) this.rend.draw();
    }

    drawScrubber(flush = true) {
        const pfg = this.ui.primary_fg;
        
        const position = parseFloat(this.player.getPosition().toFixed(0));
        const minutesPlayed = (position - (position % 60))/60;
        const secondsPlayed = position % 60;

        const length = parseFloat(this.player.getTotalLength().toFixed(0));
        const totalSeconds = length % 60;
        const totalMinutes = (length - totalSeconds)/60;

        const played = `${minutesPlayed}:${secondsPlayed.toString().padStart(2,'0')}`;

        this.rend.text(
            Math.floor((this.ui.bottomBarWidth-Math.floor(this.ui.bottomBarWidth/2))/2)-played.length-1,
            this.ui.trackHeight+Math.floor(this.ui.bottomBarHeight/2),
            played,
            pfg
        );
        this.rend.text(
            Math.floor((this.ui.bottomBarWidth-Math.floor(this.ui.bottomBarWidth/2))/2),
            this.ui.trackHeight+Math.floor(this.ui.bottomBarHeight/2),
            ''.padEnd(Math.floor(this.ui.bottomBarWidth/2), this.ui.playbar_char),
            this.ui.playbar_color
        );
        this.rend.text(
            Math.floor((this.ui.bottomBarWidth-Math.floor(this.ui.bottomBarWidth/2))/2),
            this.ui.trackHeight+Math.floor(this.ui.bottomBarHeight/2),
            ''.padEnd(Math.floor(this.ui.bottomBarWidth/2 * this.player.getPosition()/(this.player.getTotalLength() ?? 1)), this.ui.playbar_fillchar),
            this.ui.playbar_fillcolor
        );
        this.rend.text(
            Math.floor((this.ui.bottomBarWidth-Math.floor(this.ui.bottomBarWidth/2))/2)+Math.floor(this.ui.bottomBarWidth/2)+1,
            this.ui.trackHeight+Math.floor(this.ui.bottomBarHeight/2),
            `${totalMinutes}:${totalSeconds.toString().padStart(2,'0')}`,
            pfg
        );

        if(flush) this.rend.draw();
    }

    drawMediaControls(flush = true) {
        this.drawButton(
            Math.floor((this.ui.bottomBarWidth-Math.floor(this.ui.bottomBarWidth/2))/2)+Math.floor(this.ui.bottomBarWidth/4)-5,
            this.ui.trackHeight+1,
            '<<', utils.grad([0, 0, 0]), utils.grad([255, 255, 255])
        );

        this.drawButton(
            Math.floor((this.ui.bottomBarWidth-Math.floor(this.ui.bottomBarWidth/2))/2)+Math.floor(this.ui.bottomBarWidth/4),
            this.ui.trackHeight+1,
            this.player.isPaused() ? '|>' : '||', utils.grad([0, 0, 0]), utils.grad([255, 255, 255])
        );

        this.drawButton(
            Math.floor((this.ui.bottomBarWidth-Math.floor(this.ui.bottomBarWidth/2))/2)+Math.floor(this.ui.bottomBarWidth/4)+5,
            this.ui.trackHeight+1,
            '>>', utils.grad([0, 0, 0]), utils.grad([255, 255, 255])
        );

        const {w, h} = this.size;
        this.drawButton(w-this.ui.playingNowWidth+18, h-2, `Settings`, utils.grad([0, 0, 0]), utils.grad([255, 255, 255]));

        if(flush) this.rend.draw();
    }

    drawSideInfo(flush = true) {
        const { w } = this.size;
        const pfg = this.ui.primary_fg;
        const sfg = this.ui.secondary_fg;

        if(flush) this.rend.clearText(w-this.ui.playingNowWidth, 0, this.ui.playingNowWidth, this.ui.playingNowHeight);

        const imgHeight = Math.floor((this.ui.playingNowWidth-4)/2)-1;
        this.rend.box(w-this.ui.playingNowWidth, 0, this.ui.playingNowWidth, this.ui.playingNowHeight, 'Active', pfg);
        this.rend.rect(w-this.ui.playingNowWidth+2, 2, this.ui.playingNowWidth-4, imgHeight, utils.grad([0,0,0]));
        this.rend.text(w-this.ui.playingNowWidth+2, imgHeight+3, `${this.activeTrack ? (this.activeTrack.tag?.title ?? this.activeTrack.file).slice(0, this.ui.playingNowWidth-4) : 'Song title'}`, pfg);
        this.rend.text(w-this.ui.playingNowWidth+2, imgHeight+4, `${this.activeTrack ? (this.activeTrack.tag?.artists?.join(', ') ?? '') : 'Artist'}`, sfg);

        if(flush) this.rend.draw();
    }

    drawSettings(flush = true) {
        const { w, h } = this.size;
        const pfg = this.ui.primary_fg;
        const sfg = this.ui.secondary_fg;

        this.rend.clearText(
            Math.floor((w-this.ui.settingsWidth)/2), Math.floor((h-this.ui.settingsHeight)/2),
            this.ui.settingsWidth, this.ui.settingsHeight
        );
        this.rend.box(
            Math.floor((w-this.ui.settingsWidth)/2), Math.floor((h-this.ui.settingsHeight)/2),
            this.ui.settingsWidth, this.ui.settingsHeight,
            `Settings`, pfg
        );

        for(let i=0;i<this.settings.length;i++) {
            this.rend.text(
                Math.floor((w-this.ui.settingsWidth)/2)+2,
                Math.floor((h-this.ui.settingsHeight)/2)+1+i*2,
                this.settings[i].name,
                pfg
            );
            this.rend.text(
                Math.floor((w-this.ui.settingsWidth)/2)+2,
                Math.floor((h-this.ui.settingsHeight)/2)+2+i*2,
                this.settings[i].description,
                sfg
            );
            switch(this.settings[i].type) {
                case 'boolean':
                    this.drawSlider(
                        Math.floor((w+this.ui.settingsWidth)/2)-6,
                        Math.floor((h-this.ui.settingsHeight)/2)+1+i*2,
                        this.settings[i].value as boolean,
                        pfg
                    );
                break;
            }
        }
        
        if(flush) this.rend.draw();
    }

    drawSlider(x: number, y: number, active: boolean, bg?: utils.Gradient) {
        this.rend.rect(x+1, y, 2, 1, active ? utils.grad([0,255,0]) : utils.grad([255,0,0]));
        if(active) {
            this.rend.text(x+1, y, ` \ue0b6\ue0b4`, bg);
            this.rend.text(x, y, `\ue0b6`, utils.grad([0,255,0]));
        } else {
            this.rend.text(x, y, `\ue0b6\ue0b4`, bg);
            this.rend.text(x+3, y, `\ue0b4`, utils.grad([255,0,0]));
        }
    }

    drawButton(x: number, y: number, s: string, fg?: utils.Gradient, bg?: utils.Gradient) {
        this.rend.rect(x+1, y, s.length, 1, bg);
        this.rend.text(x, y, `\ue0b6${''.padStart(s.length)}\ue0b4`, bg);
        this.rend.text(x+1, y, s, fg);
    }

    handleClick(x: number, y: number) {
        const pStart = Math.floor((this.ui.bottomBarWidth-Math.floor(this.ui.bottomBarWidth/2))/2)+Math.floor(this.ui.bottomBarWidth/4);

        if( x >= 1 && x < this.ui.trackWidth-1 && y > 1 && y < this.ui.trackHeight) {
            this.selectWithOffset(y-2);
        } else if(x >= pStart && x <= pStart+4 && y == this.ui.trackHeight+2) {
            this.toggle();
        }
    }

    handleScroll(x: number, y: number, count: number) {
        if( x >= 1 && x < this.ui.trackWidth-1 && y > 1 && y < this.ui.trackHeight) {
            if(count > 0) {
                app.scrollDown(5);
            } else {
                app.scrollUp(5);
            }

            app.drawTracks();
        }
    }

    trackUp() {
        if((this.trackSel) <= 0) {
            // utils.bell();
        } else if((this.trackSel-this.trackOff) > 0) {
            this.trackSel--;
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
        } else if((this.trackSel-this.trackOff) < this.ui.trackHeight-3) {
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
            if(this.trackOff > this.tracks.length-this.ui.trackHeight+1) {
                utils.bell();
                break;
            } else {
                this.trackOff++;
            }
        }
    }

    playAt() {
        this.player.loadFile(path.join(TEMP_PATH, this.tracks[this.trackSel].file));
        this.player.play(0);
        this.activeTrack = this.tracks[this.trackSel];
        this.drawSideInfo(true);
    }

    selectWithOffset(x: number) {
        if(this.tracks[this.trackOff + x]) {
            if(this.trackSel == this.trackOff + x) {
                this.playAt();
            } else {
                this.trackSel = this.trackOff + x;
            }
            this.render();
        } else utils.bell();
    }

    /**
     * Toggle whether the audio is playing or not
     */
    toggle() {
        if(this.player.isPaused())
            this.player.resume();
        else
            this.player.pause();

        this.drawMediaControls();
        this.rend.draw();
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
