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
export type Gradient = [RGB, RGB, boolean?];

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
    let st = `\x9b`;

    if(styles.bold) st += `1;`;
    if(styles.faint) st += `2;`;
    if(styles.italic) st += `3;`;
    if(styles.underline) st += `4;`;
    if(styles.blinking) st += `5;`;
    if(styles.reverse) st += `7;`;
    if(styles.hidden) st += `8;`;
    if(styles.strikethrough) st += `9;`;

    if(st == `\x9b`) return ``;
    if(st.endsWith(';')) return st.substring(0, st.length-1) + 'm';
    return ``;
}

export function disableStyles(styles: Partial<TextStyles>) {
    let st = `\x9b`;

    if(styles.bold) st += `22;`;
    if(styles.faint) st += `22;`;
    if(styles.italic) st += `23;`;
    if(styles.underline) st += `24;`;
    if(styles.blinking) st += `25;`;
    if(styles.reverse) st += `27;`;
    if(styles.hidden) st += `28;`;
    if(styles.strikethrough) st += `29;`;

    if(st == `\x9b`) return ``;
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

export function write(s: string) {
    // console.log(s.length);
    writeAllSync(Deno.stderr, new TextEncoder().encode(s));
}

// This is roughly what all the terminal colors
// are
const terminalColors = [
    [0, 0, 0],          // 0: black
    [205, 0, 0],        // 1: red
    [0, 205, 0],        // 2: green
    [205, 205, 0],      // 3: yellow
    [0, 0, 205],        // 4: blue
    [205, 0, 205],      // 5: magenta
    [0, 205, 205],      // 6: cyan
    [229, 229, 229],    // 7: white
    [127, 127, 127],    // 8: bright black (gray)
    [255, 0, 0],        // 9: bright red
    [0, 255, 0],        // 10: bright green
    [255, 255, 0],      // 11: bright yellow
    [92, 92, 255],      // 12: bright blue
    [255, 0, 255],      // 13: bright magenta
    [0, 255, 255],      // 14: bright cyan
    [255, 255, 255],    // 15: bright white
];

export function frgb(rgb: RGB, foreground: boolean, convert?: '16-color' | '256-color') {
    if(convert == '16-color') {
        let closestColorIndex = 0;
        let minDistance = Infinity;

        for (let i = 0; i < terminalColors.length; i++) {
            const color = terminalColors[i];
            const distance = Math.sqrt(
                Math.pow(rgb[0] - color[0], 2) + Math.pow(rgb[1] - color[1], 2) + Math.pow(rgb[2] - color[2], 2)
            );
            if (distance < minDistance) {
                minDistance = distance;
                closestColorIndex = i;
            }
        }

        // Return the closest terminal color index
        if(foreground) {
            if(closestColorIndex < 8) return `\x9b3${closestColorIndex}m`;
            return `\x9b9${closestColorIndex-8}m`;
        } else {
            if(closestColorIndex < 8) return `\x9b4${closestColorIndex}m`;
            return `\x9b10${closestColorIndex-8}m`;
        }
    } else if(convert == '256-color') {
        const colorCube = [];
        for (let rIndex = 0; rIndex <= 5; rIndex++) {
            for (let gIndex = 0; gIndex <= 5; gIndex++) {
                for (let bIndex = 0; bIndex <= 5; bIndex++) {
                    colorCube.push([
                        Math.round(rIndex * 42.5),  // Scale from 0-255 in 6 levels
                        Math.round(gIndex * 42.5),
                        Math.round(bIndex * 42.5)
                    ]);
                }
            }
        }

        // Grayscale colors (232-255)
        const grayscaleColors = [];
        for (let i = 0; i < 24; i++) {
            const grayValue = Math.round(i * 10.5); // Scale from 0 to 255 in 24 levels
            grayscaleColors.push([grayValue, grayValue, grayValue]);
        }

        // Combine all the colors (16 basic colors + 216 colors from the color cube + 24 grayscale colors)
        const allColors = [...terminalColors, ...colorCube, ...grayscaleColors];

        // Calculate the closest color by finding the smallest Euclidean distance
        let closestColorIndex = 0;
        let minDistance = Infinity;

        for (let i = 0; i < allColors.length; i++) {
            const color = allColors[i];
            const distance = Math.sqrt(
                Math.pow(rgb[0] - color[0], 2) + Math.pow(rgb[1] - color[1], 2) + Math.pow(rgb[2] - color[2], 2)
            );
            if (distance < minDistance) {
                minDistance = distance;
                closestColorIndex = i;
            }
        }

        if(foreground) return `\x9b38;5;${closestColorIndex}m`;
        else return `\x9b48;5;${closestColorIndex}m`
    } else {
        if(foreground)
            return `\x9b38;2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
        else
            return `\x9b48;2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
    }
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
    return `\x9b${y+1};${x+1}H`;
}

export function cursorDown(i: number = 1) {
    return `\x9b${i}B`;
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
    write(`\x9b?1000;1003;1006;1015h`);
}

export function disableMouse() {
    write(`\x9b?1000;1003;1006;1015l`);
}

export function setTitle(title: string) {
    write(`\x1b]0;${title} \x07`);
}

export function setCursor(shape: CursorShape) {
    write(`\x9b${shape} q`);
}

export function showCursor() {
    write(`\x9b?25h`);
}

export function hideCursor() {
    write(`\x9b?25l`);
}

export function setAltBuffer(alt: boolean) {
    if(alt) write(`\x9b?1049h`);
    else    write(`\x9b?1049l`);
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