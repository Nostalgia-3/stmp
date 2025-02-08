import { color } from "./itui.ts";
import * as utils from "./utils.ts";
import { TextStyles } from "./utils.ts";

export class Renderer {
    public s: string;
    protected c: [utils.RGB, utils.RGB][];
    protected width: number;
    protected height: number;

    protected transparency: boolean;
    protected lastBG: utils.RGB;
    protected lastFG: utils.RGB;

    constructor(width: number, height: number) {
        this.s = '';
        this.c = [];
        this.width = width;
        this.height = height;
        this.transparency = false;
        this.lastFG = [0, 0, 0];
        this.lastBG = [0, 0, 0];
        for(let i=0;i<width*height;i++) {
            this.c[i] = [[0,0,0],[0,0,0]];
        }
    }

    protected setFG(x: number, y: number, c: utils.RGB) {
        this.c[Math.min(x,this.height-1)+Math.min(y,this.height-1)*this.width][0] = c;
    }

    protected setBG(x: number, y: number, c: utils.RGB) {
        try {
            this.c[x+Math.min(y, this.height-1)*this.width][1] = c;
        } catch(e) {
            const { columns, rows } = Deno.consoleSize();
            console.error(`setBG(${x}, ${y}) FAILED @ point ${x+y*this.width} [${this.c[x+y*this.width]}] (col=${columns-1}, rows=${rows})`);
            throw e;
        }
    }

    writeFG(x: number, y: number, c?: utils.RGB) {
        if(!c) {
            if(this.getFG(x, y).join('') != this.lastFG.join('')) {
                this.s += utils.frgb(this.getFG(x, y), true);
                this.lastFG = this.getFG(x, y);
            }
        } else if(c.join('') != this.lastFG.join('')) {
            this.s += utils.frgb(c, true);
            this.lastFG = c;
        }
    }

    writeBG(x: number, y: number, c?: utils.RGB) {
        if(!c) {
            if(this.getBG(x, y).join('') != this.lastBG.join('')) {
                this.s += utils.frgb(this.getBG(x, y), false);
                this.lastBG = this.getBG(x, y);
            }
        } else if(this.transparency && c.join('') == '000' && c.join('') != this.lastBG.join('')) {
            this.s += `\x1b[0m`;
            this.lastFG = [0,0,0];
            this.lastBG = [0,0,0];
        } else if(c.join('') != this.lastBG.join('')) {
            this.s += utils.frgb(c, false);
            this.lastBG = c;
        }
    }

    public getFG(x: number, y: number) {
        return this.c[Math.min(x,this.height-1)+Math.min(y,this.height-1)*this.width][0];
    }

    public getBG(x: number, y: number) {
        try {
            return this.c[Math.min(x,this.width-1)+Math.min(y, this.height-1)*this.width][1];
        } catch(e) {
            const { columns, rows } = Deno.consoleSize();
            console.error(`getBG(${x}, ${y}) FAILED ; ${x+y*this.width} (dim: ${columns}, ${rows}) sizeof(c)=${this.c.length} `);
            throw e;
        }
    }

    clearText(x: number, y: number, w: number, h: number) {
        for(let i=0;i<h;i++) {
            this.s += `${utils.cursorTo(x, y+i)}${utils.frgb(this.getBG(x, y+i), false)}${''.padStart(w, ' ')}`;
        }
    }

    clear(bg: utils.Gradient) {
        for(let i=0;i<this.height;i++) {
            const col = utils.interpolate(bg[0], bg[1], i/this.height);
            for(let j=0;j<this.width;j++)
                this.setBG(j, i, col);
            this.writeBG(0, i, col);
            this.s += `${utils.cursorTo(0, i)}\x1b[0J`; // {''.padStart(this.width, ' ')}
        }
    }

    text(x: number, y: number, s: string, fg?: utils.Gradient, bg?: utils.Gradient, styles: Partial<TextStyles> = {}) {
        this.s += utils.cursorTo(x,y) + utils.enableStyles(styles);

        for(let i=0;i<s.length;i++) {
            const fgc = fg ? utils.interpolate(fg[0], fg[1], i/s.length) : this.getFG(x+i,y); // undefined
            const bgc = bg ? utils.interpolate(bg[0], bg[1], i/s.length) : this.getBG(x+i,y); // undefined
            if(fgc) this.setFG(x + i, y, fgc);
            if(bgc) this.setBG(x + i, y, bgc);
            this.writeFG(x + i, y, fgc);
            this.writeBG(x + i, y, bgc);
            this.s += `${s[i]}`;
        }

        this.s += utils.disableStyles(styles);
    }

    vline(x: number, y: number, h: number, fg: utils.Gradient, bg?: utils.Gradient, ch: string = '│') {
        if(fg && fg[0] == fg[1]) this.s += `${utils.frgb(fg[0], true)}`;
        if(bg && bg[0] == bg[1]) this.s += `${utils.frgb(bg[0], false)}`;
        
        for(let i=0;i<h;i++) {
            const fgc = utils.interpolate(fg[0], fg[1], i/h);
            const bgc = bg ? utils.interpolate(bg[0], bg[1], i/h) : undefined;
            this.setFG(x, y+i, fgc);
            if(bgc) this.setBG(x, y+i, bgc);
            this.writeBG(x, y+i, bgc);
            this.writeFG(x, y+i, fgc);
            this.s += `${utils.cursorTo(x,y+i)}${ch}`;
        }
    }

    hline(x: number, y: number, w: number, fg: utils.Gradient, bg?: utils.Gradient, ch = '─') {
        if(isNaN(w)) return;

        this.s += utils.cursorTo(x,y);
        // if(fg && fg[0] == fg[1]) this.s += `${utils.frgb(fg[0], true)}`;
        // if(bg && bg[0] == bg[1]) this.s += `${utils.frgb(bg[0], false)}`;

        for(let i=0;i<w;i++) {
            const fgc = utils.interpolate(fg[0], fg[1], i/w);
            const bgc = bg ? utils.interpolate(bg[0], bg[1], i/w) : undefined;
            this.setFG(x+i, y, fgc);
            if(bgc) this.setBG(x+i, y, bgc);
            this.writeFG(x+i, y, fgc);
            this.writeBG(x+i, y, bgc);
            this.s += `${ch}`;
        }
    }

    rect(x: number, y: number, w: number, h: number, bg?: utils.Gradient) {
        if(w >= this.width && h >= this.height) {
            this.clear(bg ?? color('#000'));
            return;
        }
        if(!bg) {
            if(!this.transparency) return;
            
            for(let i=0;i<h;i++) {
                for(let j=0;j<w;j++)
                    this.setBG(x+j, y+i, [0,0,0]);
                this.s += `${utils.cursorTo(x,y+i)}${''.padStart(w,' ')}`;
            }

            return;
        }

        if(bg[0] == bg[1]) this.s += utils.frgb(bg[0], false);
        for(let i=0;i<h;i++) {
            const col = utils.interpolate(bg[0], bg[1], i/h);
            for(let j=0;j<w;j++)
                this.setBG(x+j, y+i, col);
            this.writeBG(x, y+i, col);
            // ${''.padStart((w-(w%8))/8, '\t')}${''.padStart(w%8)}
            this.s += `${utils.cursorTo(x,y+i)}${''.padStart(w)}`;
        }
    }

    box(x: number, y: number, w: number, h: number, text: string, fg: utils.Gradient, bg?: utils.Gradient) {
        if(bg) this.rect(x, y, w, h, bg);
        this.text(x, y, (`╭─ ${text} `.padEnd(w-1, '─') + `╮`), fg);
        this.vline(x, y+1, h-2, [fg[0], fg[0]]);
        this.vline(x+w-1, y+1, h-2, [fg[1], fg[1]]);
        this.text(x, y+h-1, `╰${''.padEnd(w-2, '─')}╯`, fg);
    }

    resize(w: number, h: number) {
        this.width = w;
        this.height = h;
        this.c = [];
        for(let i=0;i<w*h;i++) {
            this.c[i] = [[0,0,0],[0,0,0]];
        }
    }

    reset() {
        this.s = '';
        for(let i=0;i<this.width*this.height;i++) {
            this.c[i] = [[0,0,0],[0,0,0]];
        }
    }

    draw() {
        utils.write(this.s);
        this.s = '';
    }

    flush() {
        this.s = '';
    }

    setTransparency(b: boolean) {
        this.transparency = b;
    }
}
