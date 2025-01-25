import { parseHexColor } from "./utils.ts";

export type Color       = [number, number, number];
export type Size        = { type: 'percentage' | 'grow' | 'static', val: number };
export type Gradient    = { direction: 'h'|'v', cols: Color[] };
export type Padding     = { top: number, bottom: number, left: number, right: number };

export enum Direction {
    Horizontal,
    Vertical
}

export function size_static(c: number): Size {
    return { type: 'static', val: c };
}

export function size_percentage(c: number): Size {
    return { type: 'static', val: c/100 };
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

export function color(c: string | [number, number, number]): Gradient {
    if(typeof(c) == 'string') return { direction: 'h', cols: [parseHexColor(c)] };
    return { direction: 'h', cols: [c] };
}

export type ItuiStyle = {
    w: Size,
    h: Size,
    fg: Gradient,
    bg: Gradient,
    padding: Padding,
    child_dir: Direction;
};

export type ContentNode = {
    id?: string,
    type: 'rect' | 'text' | 'image',
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

    protected parseSize(size: Size, v: number) {
        switch(size.type) {
            case "percentage": return { v: v*Math.min(size.val, 1), d: true };
            case "grow": return { v, d: false };
            case "static": return { v: size.val, d: true };
        }
    }

    /**
     * Parse a node tree, returning a list of
     * renderer commands.
     * @param node The root node in a node tree to parse
     */
    layout(node: ContentNode, w: number, h: number, x: number, y: number) {
        let renderCommands: RenderCommand[] = [];
        if(!node.style.w) node.style.w = size_grow();
        if(!node.style.h) node.style.h = size_grow();

        const dir = node.style.child_dir ?? Direction.Horizontal;
        const cW = this.parseSize(node.style.w, w);
        const cH = this.parseSize(node.style.h, h);
        let cX = x;
        let cY = y;

        switch(node.type) {
            case 'rect':
                renderCommands.push({ type: 'rect', x: cX, y: cY, w: cW.v, h: cH.v, color: node.style.bg ?? color('#FFF') });
            break;

            case 'text':
                renderCommands.push({ type: 'text', x: cX, y: cY, text: node.content as string, color: node.style.fg ?? color('#FFF') });
            break;
        }

        cX += (cW.d ? cW.v : 0);
        cY += (cH.d ? cH.v : 0);

        for(let i=0;i<node.children.length;i++) {
            const r = this.layout(node.children[i], cW.v, h, cX, cY);
            if(r.sU[0].d) cW.v -= r.sU[0].v;
            if(r.sU[1].d) cH.v -= r.sU[1].v;
            if(dir == Direction.Horizontal) cX += r.sU[0].v;
            else cY += r.sU[1].v;
            renderCommands = renderCommands.concat(r.c);
        }

        return { c: renderCommands, sU: [cW, cH] };
    }

    rectangle(id: string, style: Partial<ItuiStyle>, children?: ContentNode[]) {
        return {
            id, type: 'rect',
            style, children: children ?? []
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