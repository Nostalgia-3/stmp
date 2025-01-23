import { parseHexColor } from "./utils.ts";

export type Color       = { r: number, g: number, b: number };
export type Size        = { type: 'percentage' | 'grow' | 'static', val: number };
export type Gradient    = { direction: 'h'|'v', cols: Color[] };
export type Padding     = { top: number, bottom: number, left: number, right: number };

export function size_static(c: number): Size {
    return { type: 'static', val: c };
}

export function size_percentage(c: number): Size {
    return { type: 'static', val: c };
}

export function size_grow(): Size {
    return { type: 'grow', val: 0 };
}

export function padding_all(n: number): Padding {
    return { top: n, bottom: n, left: n, right: n };
}

export function padding_down(n: number): Padding {
    return { top: 0, bottom: n, left: 0, right: 0 };
}

export function color(c: string | Color | [number, number, number]): Gradient {
    if(typeof(c) == 'string') return { direction: 'h', cols: [parseHexColor(c)] };
    if(Array.isArray(c)) return { direction: 'h', cols: [{ r: c[0], g: c[1], b: c[2] }] };
    return { direction: 'h', cols: [c] };
}

export type ItuiStyle = {
    w: Size,
    h: Size,
    fg: Gradient,
    bg: Gradient,
    padding: Padding
};

export type ContentNode = {
    id?: string,
    type: string,
    style: Partial<ItuiStyle>,
    children: ContentNode[],
    content?: unknown
};

export type RenderCommand =
    { type: 'rect', x: number, y: number, w: number, h: number, color: Gradient } |
    { type: 'text', x: number, y: number, text: string, color: Gradient } |
    { type: 'image', x: number, y: number, w: number, h: number, pixels: number[] };

export class Itui {
    constructor() {

    }

    /**
     * Parse a node tree, returning a list of
     * renderer commands.
     * @param node The node tree to parse
     */
    layout(node: ContentNode) {
        const renderCommands: RenderCommand[] = [];

        switch(node.type) {
            case 'text':
                renderCommands.push({
                    type: 'text', x: 0, y: 0,
                    color: node.style.fg ?? color({ r: 0, g: 0, b: 0 }),
                    text: node.content as string
                });
            break;
        }

        return renderCommands;
    }

    rectangle(id: string, style: Partial<ItuiStyle>, children?: ContentNode[]) {
        return {
            id, type: 'rectangle',
            style, children
        } as ContentNode;
    }

    text(id: string, style: Partial<ItuiStyle>, content: string) {
        return {
            id, type: 'text',
            content,
            style, children: []
        } as ContentNode;
    }

    image(id: string, style: Partial<ItuiStyle>) {
        return {
            id, type: 'image',
            style, children: []
        } as ContentNode;
    }
}