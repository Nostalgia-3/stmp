import * as utils from "./utils.ts";
import { TextStyles } from "./utils.ts";

export class Renderer {
    protected s: string;
    protected c: [utils.RGB, utils.RGB][];
    protected width: number;
    protected height: number;

    constructor(width: number, height: number) {
        this.s = '';
        this.c = [];
        this.width = width;
        this.height = height;
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
        this.s += `\x1b[0m`;
    }

    clear(bg: utils.Gradient) {
        for(let i=0;i<this.height;i++) {
            const col = utils.interpolate(bg[0], bg[1], i/this.height);
            for(let j=0;j<this.width;j++)
                this.setBG(j, i, col);
            this.s += `${utils.cursorTo(0, i)}${utils.frgb(col, false)}${''.padStart(this.width, ' ')}`;
        }
        this.s += `\x1b[0m`;
    }

    text(x: number, y: number, s: string, fg?: utils.Gradient, bg?: utils.Gradient, styles: Partial<TextStyles> = {}) {
        this.s += utils.cursorTo(x,y) + utils.enableStyles(styles);
        if(fg && fg[0] == fg[1]) this.s += `${utils.frgb(fg[0], true)}`;
        if(bg && bg[0] == bg[1]) this.s += `${utils.frgb(bg[0], false)}`;

        let lastFG;
        let lastBG;
        for(let i=0;i<s.length;i++) {
            const fgc = fg ? utils.interpolate(fg[0], fg[1], i/s.length) : this.getFG(x+i, y);
            const bgc = bg ? utils.interpolate(bg[0], bg[1], i/s.length) : this.getBG(x+i, y);
            if(fg) this.setFG(x + i, y, fgc);
            if(bg) this.setBG(x + i, y, bgc);
            const bgtext = (lastBG?.join('') != bgc.join('')) && (bgc.join('') != '000' && (bg == undefined || bg[0] != bg[1])) ? utils.frgb(bgc, false) : '';
            const fgtext = (lastFG?.join('') != fgc.join('')) && (fg == undefined || fg[0] != fg[1]) ? utils.frgb(fgc, true) : '';
            this.s += `${bgtext}${fgtext}${s[i]}`;
            lastFG = fgc;
            lastBG = bgc;
        }

        this.s += utils.disableStyles(styles) + `\x1b[0m`;
    }

    vline(x: number, y: number, h: number, fg: utils.Gradient, bg?: utils.Gradient, ch: string = '│') {
        if(fg && fg[0] == fg[1]) this.s += `${utils.frgb(fg[0], true)}`;
        if(bg && bg[0] == bg[1]) this.s += `${utils.frgb(bg[0], false)}`;
        
        for(let i=0;i<h;i++) {
            const fgc = utils.interpolate(fg[0], fg[1], i/h);
            const bgc = bg ? utils.interpolate(bg[0], bg[1], i/h) : this.getBG(x, y+i);
            this.setFG(x, y+i, fgc);
            if(bg) this.setBG(x, y+i, bgc);
            this.s += `${utils.cursorTo(x,y+i)}${(fg == undefined || fg[0] != fg[1]) ? utils.frgb(fgc, true) : ''}${(bgc.join('') != '000' && (bg == undefined || bg[0] != bg[1])) ? utils.frgb(bgc, false) : ''}${ch}`;
        }
        this.s += `\x1b[0m`;
    }

    hline(x: number, y: number, w: number, fg: utils.Gradient, bg?: utils.Gradient, ch = '─') {
        this.s += utils.cursorTo(x,y);
        if(fg && fg[0] == fg[1]) this.s += `${utils.frgb(fg[0], true)}`;
        if(bg && bg[0] == bg[1]) this.s += `${utils.frgb(bg[0], false)}`;

        for(let i=0;i<w;i++) {
            const fgc = utils.interpolate(fg[0], fg[1], i/w);
            const bgc = bg ? utils.interpolate(bg[0], bg[1], i/w) : this.getBG(x, y+i);
            this.setFG(x+i, y, fgc);
            if(bg) this.setBG(x+i, y, bgc);
            this.s += `${(fg == undefined || fg[0] != fg[1]) ? utils.frgb(fgc, true) : ''}${(bgc.join('') != '000' && (bg == undefined || bg[0] != bg[1])) ? utils.frgb(bgc, false) : ''}${ch}`;
        }
        this.s += `\x1b[0m`;
    }

    rect(x: number, y: number, w: number, h: number, bg?: utils.Gradient) {
        if(!bg) {
            // this.s += `\x1b[0m`;
            // for(let i=0;i<h;i++) {
            //     for(let j=0;j<w;j++)
            //         this.setBG(x+j, y+i, [0,0,0]);
            //     this.s += `${utils.cursorTo(x,y+i)}${''.padStart(w)}`;
            //     // ${''.padStart((w-w%8)/8, '\t')}
            // }
            return;
        }

        if(bg[0] == bg[1]) this.s += utils.frgb(bg[0], false);
        for(let i=0;i<h;i++) {
            const col = utils.interpolate(bg[0], bg[1], i/h);
            for(let j=0;j<w;j++)
                this.setBG(x+j, y+i, col);
            // ${''.padStart(w)}
            this.s += `${utils.cursorTo(x,y+i)}${(bg[0] != bg[1]) ? utils.frgb(col, false) : ''}${''.padStart(w)}`;
        }
        this.s += `\x1b[0m`;
    }

    box(x: number, y: number, w: number, h: number, text: string, fg: utils.Gradient, bg?: utils.Gradient) {
        if(bg) this.rect(x, y, w, h, bg);
        this.text(x, y, (`╭─ ${text} `.padEnd(w-1, '─') + `╮`), fg);
        this.vline(x, y+1, h-2, utils.grad(fg[0]));
        this.vline(x+w-1, y+1, h-2, utils.grad(fg[1]));
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
}
