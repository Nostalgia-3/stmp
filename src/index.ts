import { Keypress, readKeypress } from "https://deno.land/x/keypress@0.0.11/mod.ts";

import { extname } from "node:path";

import { Player } from "./player.ts";
import { Renderer } from "./renderer.ts";
import * as utils from './utils.ts';
import { Genre, getFileID3 } from "./id3.ts";

type Track = {
    title?:     string,
    artist?:    string,
    album?:     string,
    year?:      string,
    comment?:   string,
    genre?:     Genre,
    file:       string
};

// const TEMP_PATH = `/home/nostalgia3/Music/`;
const TEMP_PATH = `D:/Music/mp3`;

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

    protected ui = {
        titleMaxWidth:      30, // Maximum title width

        playingNowWidth:    30,
        bottomBarWidth:     -1,
        bottomBarHeight:    4,
        trackWidth:         -1,
        trackHeight:        -1,
        playingNowHeight:   -1,
    };

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
            if(extname(entry.name) != '.mp3') continue;
            const tags = await getFileID3(`${TEMP_PATH}/${entry.name}`);

            this.tracks.push({ file: entry.name, ...tags });
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
                        this.trackUp();
                        this.update();
                        break;
    
                    case 'down':
                        this.trackDown();
                        this.update();
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
        this.rend.size(w, h);

        const gfore = utils.grad([255, 255, 255]);
        const afore = utils.grad([192, 192, 192]);
        // const gfore = utils.grad([0, 0, 0]);
        // const afore = utils.grad([128, 128, 128]);

        this.ui.bottomBarWidth  = w;
        this.ui.bottomBarHeight = 4;
        this.ui.trackWidth      = w-this.ui.playingNowWidth;
        this.ui.trackHeight     = h-this.ui.bottomBarHeight;
        this.ui.playingNowHeight= h-this.ui.bottomBarHeight;
        
        this.rend.clear([[97, 67, 133], [81, 99, 149]]);        // Kashmir
        // this.rend.clear([[238, 156, 167], [255, 221, 225]]);    // Piglet
        // this.rend.clear([[255, 95, 109], [255, 195, 113]]);     // Sweet Morning
        
        if(w < this.ui.playingNowWidth) {
            // draw smaller UI
        } else {
            this.drawTracks(false);
            this.drawScrubber(false);
            this.drawMediaControls(false);

            // render playing now menu
            const imgHeight = Math.floor((this.ui.playingNowWidth-4)/2)-1;
            this.rend.box(w -this.ui.playingNowWidth, 0, this.ui.playingNowWidth, this.ui.playingNowHeight, 'Active', gfore);
            this.rend.rect(w-this.ui.playingNowWidth+2, 2, this.ui.playingNowWidth-4, imgHeight, utils.grad([0,0,0]));
            this.rend.text(w-this.ui.playingNowWidth+2, imgHeight+3, `${this.activeTrack ? (this.activeTrack.title ?? 'Unknown') : 'Song title'}`, gfore);
            this.rend.text(w-this.ui.playingNowWidth+2, imgHeight+4, `${this.activeTrack ? (this.activeTrack.artist ?? 'Unknown') : 'Artist'}`, afore);

            this.drawButton(w-this.ui.playingNowWidth+18, h-2, `Settings`, utils.grad([0, 0, 0]), utils.grad([255, 255, 255]));
        }

        this.rend.flush();
    }

    drawTracks(flush = true) {
        const gfore = utils.grad([255, 255, 255]);
        const afore = utils.grad([192, 192, 192]);

        this.rend.box(0, 0, this.ui.trackWidth, this.ui.trackHeight, 'Tracks', gfore);

        // this.rend.clearText(
        //     1, 1,
        //     this.ui.trackWidth-2, this.ui.trackHeight-2
        // );

        if(this.tracks.length == 0) {
            if(flush) this.rend.flush();
            return;
	    }

        // This is "slow", but unless the track list is absolutely massive,
        // this should be fine
        const longestTrackTitle = this.tracks
            .map((v)=>(v.title??v.file).length)
            .sort((a,b)=>b-a)[0]
        ;

        for(let i=0;i<this.ui.trackHeight-2;i++) {
            if(this.tracks[this.trackOff+i] == undefined) {
                break;
            }

            const track     = this.tracks[this.trackOff+i];

            const selected  = this.trackSel == (i+this.trackOff);
            const fore      = selected ? utils.grad([0, 0, 0]) : gfore;
            const back      = selected ? utils.grad([220, 220, 220]) : undefined;

            this.rend.rect(1, i+1, this.ui.trackWidth-3, 1, back);
            this.rend.text(1, i+1, (track.title ?? track.file).slice(0, this.ui.trackWidth-2), fore);

            this.rend.text(1+longestTrackTitle+1, i+1, (track.artist ?? '').slice(0,this.ui.trackWidth-2), fore);
        }

        // Track scrubber
        if(this.tracks.length < this.ui.trackHeight-2) {
            this.rend.vline(this.ui.trackWidth-2, 1, this.ui.trackHeight-2, gfore, undefined, '▐');
        } else {
            const percentScrolled = (this.trackOff)/(this.tracks.length);
            const size = Math.floor((this.ui.trackHeight-2)/this.tracks.length*(this.ui.trackHeight-2));
            const offset = Math.ceil((this.ui.trackHeight-2) * percentScrolled);
            this.rend.vline(this.ui.trackWidth-2, 1, this.ui.trackHeight-2, afore, undefined, '▐');
            this.rend.vline(this.ui.trackWidth-2, 1+offset, size, gfore, undefined, '▐');
        }

        if(flush) this.rend.flush();
    }

    drawScrubber(flush = true) {
        const gfore = utils.grad([255, 255, 255]);
        const afore = utils.grad([192, 192, 192]);
        
        const position = parseFloat(this.player.getPosition().toFixed(0));
        const minutesPlayed = (position - (position % 60))/60;
        const secondsPlayed = position % 60;

        const length = parseFloat(this.player.getTotalLength().toFixed(0));
        const totalSeconds = length % 60;
        const totalMinutes = (length - totalSeconds)/60;

        const played = `${minutesPlayed}:${secondsPlayed.toString().padStart(2,'0')}`;

        const fillCharacter = '━';
        // const fillCharacter = '█';

        this.rend.text(
            Math.floor((this.ui.bottomBarWidth-Math.floor(this.ui.bottomBarWidth/2))/2)-played.length-1,
            this.ui.trackHeight+Math.floor(this.ui.bottomBarHeight/2),
            played,
            gfore
        );
        this.rend.text(
            Math.floor((this.ui.bottomBarWidth-Math.floor(this.ui.bottomBarWidth/2))/2),
            this.ui.trackHeight+Math.floor(this.ui.bottomBarHeight/2),
            ''.padEnd(Math.floor(this.ui.bottomBarWidth/2), fillCharacter),
            afore
        );
        this.rend.text(
            Math.floor((this.ui.bottomBarWidth-Math.floor(this.ui.bottomBarWidth/2))/2),
            this.ui.trackHeight+Math.floor(this.ui.bottomBarHeight/2),
            ''.padEnd(Math.floor(this.ui.bottomBarWidth/2 * this.player.getPosition()/(this.player.getTotalLength() ?? 1)), fillCharacter),
            gfore
        );
        this.rend.text(
            Math.floor((this.ui.bottomBarWidth-Math.floor(this.ui.bottomBarWidth/2))/2)+Math.floor(this.ui.bottomBarWidth/2)+1,
            this.ui.trackHeight+Math.floor(this.ui.bottomBarHeight/2),
            `${totalMinutes}:${totalSeconds.toString().padStart(2,'0')}`,
            gfore
        );

        if(flush) this.rend.flush();
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

        if(flush) this.rend.flush();
    }

    drawButton(x: number, y: number, s: string, fg?: utils.Gradient, bg?: utils.Gradient) {
        this.rend.rect(x+1, y, s.length, 1, bg);
        this.rend.text(x, y, `\ue0b6${''.padStart(s.length)}\ue0b4`, bg);
        this.rend.text(x+1, y, s, fg);
    }

    inTrackBounds(x: number, y: number) {
        if(
            x >= 1 && x < this.ui.trackWidth-1 &&
            y > 1 && y < this.ui.trackHeight
        ) return true;
        return false;
    }

    inPlayBounds(x: number, y: number) {
        const xStart = Math.floor((this.ui.bottomBarWidth-Math.floor(this.ui.bottomBarWidth/2))/2)+Math.floor(this.ui.bottomBarWidth/4);
        if(x >= xStart && x <= xStart+4 && y == this.ui.trackHeight+2) {
            return true;
        }
        return false;
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

    /**
     * Scroll the track list down, without incrementing trackSel
     */
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
        this.player.loadFile(TEMP_PATH + this.tracks[this.trackSel].file);
        this.player.play(0);
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

    togglePaused() {
        if(this.player.isPaused())
            this.player.resume();
        else
            this.player.pause();

        this.drawMediaControls();
        this.rend.flush();
    }
}

const app = new App();

app.on('click', (button, x, y, down) => {
    if(!down) return;

    if(app.inTrackBounds(x, y)) {
        if(button == 0) {
            app.selectWithOffset(y-2);
        }
    }
    if(app.inPlayBounds(x, y)) {
        app.togglePaused();
    }
});

app.on('scroll', (count, x, y) => {
    if(app.inTrackBounds(x, y)) {
        if(count > 0) {
            app.scrollDown(5);
        } else {
            app.scrollUp(5);
        }

        app.render();
        // app.drawTracks();
    }
});

app.start();
