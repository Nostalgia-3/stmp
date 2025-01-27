import { Buffer } from 'node:buffer';
import { writeAllSync } from 'https://deno.land/std@0.216.0/io/write_all.ts';
import path from 'node:path';

export function getLibrary(s: string, path?: string) {
    let suffix = '.so';
    let prefix = 'lib';

    if(Deno.build.os == 'windows') {
        suffix = '.dll';
        prefix = '';
    }

    return (path ?? '') + prefix + s + suffix;
}

export class FancyBuffer {
    protected buf: Buffer;
    protected index: number;

    constructor(buf: Uint8Array) {
        this.index = 0;
        this.buf = Buffer.from(buf);
    }

    goto(c: number) {
        this.index = c;
    }

    skip(c: number) {
        this.index += c;
    }

    readU8() {
        return this.buf.readUInt8(this.index++);
    }

    readU16BE() {
        this.index+=2;
        return this.buf.readUInt16BE(this.index-2);
    }

    readU16LE() {
        this.index+=2;
        return this.buf.readUInt16LE(this.index-2);
    }

    readU32BE() {
        this.index+=4;
        return this.buf.readUInt32BE(this.index-4);
    }

    readU32LE() {
        this.index+=4;
        return this.buf.readUInt32LE(this.index-4);
    }

    readLenAsciiString(count: number) {
        this.index+=count;
        return this.buf.subarray(this.index-count, this.index).toString('ascii');
    }

    readLenUTF8String(count: number) {
        this.index+=count;
        return this.buf.subarray(this.index-count, this.index).toString('utf8');
    }

    readLenUTF16String(count: number) {
        this.index+=count;
        return this.buf.subarray(this.index-count, this.index).toString('utf16le');
    }
}

export type RGB = [number, number, number];
export type Gradient = [RGB, RGB];

export type TextStyles = {
    bold: boolean,
    faint: boolean,
    italic: boolean,
    underline: boolean,
    blinking: boolean,
    reverse: boolean,
    hidden: boolean,
    strikethrough: boolean
};

/**
 * The shape of the cursor. Some terminals like to
 * swap STEADY and BLINKING, but the shape should
 * be the same.
 */
export enum CursorShape {
    BLINKING_BLOCK=0,
    STEADY_BLOCK=2,
    BLINKING_UNDERLINE=3,
    STEADY_UNDERLINE=4,
    BLINKING_BAR=5,
    STEADY_BAR=6
}

// deno-lint-ignore no-explicit-any
export class TypedEventEmitter<TEvents extends Record<string, any>> {
    listeners: { name: string, cb: (...eventArg: TEvents[string]) => void, once: boolean }[];

    constructor() {
        this.listeners = [];
    }

    emit<TEventName extends keyof TEvents & string>(eventName: TEventName, ...eventArg: TEvents[TEventName]) {
        for(let i=0;i<this.listeners.length;i++) {
            if(this.listeners[i].name == eventName) {
                this.listeners[i].cb(...eventArg);
                if(this.listeners[i].once) this.listeners.splice(i, 1);
            }
        }
    }

    on<TEventName extends keyof TEvents & string>(eventName: TEventName, handler: (...eventArg: TEvents[TEventName]) => void) {
        this.listeners.push({ name: eventName as string, cb: handler as ((...eventArg: TEvents[string]) => void), once: false });
    }

    once<TEventName extends keyof TEvents & string>(eventName: TEventName, handler: (...eventArg: TEvents[TEventName]) => void) {
        this.listeners.push({ name: eventName as string, cb: handler as ((...eventArg: TEvents[string]) => void), once: true });
    }
}

export function enableStyles(styles: Partial<TextStyles>) {
    let st = `\x1b[`;

    if(styles.bold) st += `1;`;
    if(styles.faint) st += `2;`;
    if(styles.italic) st += `3;`;
    if(styles.underline) st += `4;`;
    if(styles.blinking) st += `5;`;
    if(styles.reverse) st += `7;`;
    if(styles.hidden) st += `8;`;
    if(styles.strikethrough) st += `9;`;

    if(st == `\x1b[`) return ``;
    if(st.endsWith(';')) return st.substring(0, st.length-1) + 'm';
    return ``;
}

export function disableStyles(styles: Partial<TextStyles>) {
    let st = `\x1b[`;

    if(styles.bold) st += `22;`;
    if(styles.faint) st += `22;`;
    if(styles.italic) st += `23;`;
    if(styles.underline) st += `24;`;
    if(styles.blinking) st += `25;`;
    if(styles.reverse) st += `27;`;
    if(styles.hidden) st += `28;`;
    if(styles.strikethrough) st += `29;`;

    if(st == `\x1b[`) return ``;
    if(st.endsWith(';')) return st.substring(0, st.length-1) + 'm';
    return ``;
}

export function filename(s: string) {
    return path.basename(s, path.extname(s));
}

/**
 * Interpolates a color based on two other colors  
 * @param c1 The first color of the gradient
 * @param c2 The second color of the gradient
 * @param f A number between 0 and 1
 * @returns The RGB value of the point
 */
export function interpolate(c1: RGB, c2: RGB, f: number): RGB {
    // Ensure t is between 0 and 1
    f = Math.max(0, Math.min(1, f));
  
    // Return interpolated RGB color string
    return [
        Math.round(c1[0] + (c2[0] - c1[0]) * f),
        Math.round(c1[1] + (c2[1] - c1[1]) * f),
        Math.round(c1[2] + (c2[2] - c1[2]) * f)
    ];
}

export function blend(c1: RGB, c2: RGB) {
    return grad(interpolate(c1, c2, 0.5));
}

export function write(s: string) {
    writeAllSync(Deno.stdout, new TextEncoder().encode(s));
}

export function frgb(rgb: RGB, foreground: boolean) {
    if(foreground)
        return `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
    else
        return `\x1b[48;2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
}

export function parseHexColor(hex: string): RGB {
    hex = hex.replace('#', '');
  
    if(hex.length !== 3 && hex.length !== 6) {
        return [0,0,0];
    }
  
    if(hex.length === 3) {
        hex = hex.split('').map(char => char + char).join('');
    }
  
    // Parse the hex values into decimal RGB values
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
  
    return [r, g, b];
}

export function cursorTo(x: number, y: number) {
    return `\x1b[${y+1};${x+1}H`;
}

export function cursorDown(i: number = 1) {
    return `\x1b[${i}B`;
}

export function bell() {
    write(`\x07`);
}

export function enableMouse() {
    // mouse reporting = 1000
    // mouse tracking = 1003
    // mouse ?? = 1006
    // mouse ??? = 1015
    // 1003
    write(`\x1b[?1000;1006;1015h`);
}

export function disableMouse() {
    write(`\x1b[?1000;1003;1006;1015l`);
}

export function setTitle(title: string) {
    write(`\x1b]0;${title} \x07`);
}

export function setCursor(shape: CursorShape) {
    write(`\x1b[${shape} q`);
}

export function showCursor() {
    write(`\x1b[?25h`);
}

export function hideCursor() {
    write(`\x1b[?25l`);
}

export function setAltBuffer(alt: boolean) {
    if(alt) write(`\x1b[?1049h`);
    else    write(`\x1b[?1049l`);
}

/**
 * Convert an RGB into a Gradient
 * @param c The color
 * @returns A Gradient
 */
export function grad(c: RGB): Gradient {
    return [c, c];
}

export function rgb(c: { r:number,g:number,b:number }): Gradient {
    return [[c.r,c.g,c.b],[c.r,c.g,c.b]];
}

/**
 * Returns the home directory, or null if it can't find one
 */
export function homeDir(): string | null {
    switch (Deno.build.os) {
        case "linux":
        case "darwin":
            return Deno.env.get("HOME") ?? null;
        case "windows":
            return Deno.env.get("USERPROFILE") ?? null;
    }
    return null;
}

/**
 * Returns a RegExp to capture all Ansi escape codes
 */
export function ansiRegex() {
    const pattern = '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))';

    return new RegExp(pattern, 'g');
}