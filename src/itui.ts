import { randomInt } from "node:crypto";
import { parseHexColor } from "./utils.ts";

export type Color       = [number, number, number];
export type Size        = { type: 'percentage' | 'grow' | 'static', val: number };
export type Gradient    = [Color, Color];
export type Padding     = { top: number, bottom: number, left: number, right: number };

export enum Direction {
    Horizontal  = 0b01,
    Vertical    = 0b10
}

export function size_static(c: number): Size {
    return { type: 'static', val: c };
}

export function size_percentage(c: number): Size {
    return { type: 'percentage', val: c/100 };
}

export function size_grow(): Size {
    return { type: 'grow', val: 0 };
}

export function padding_all(n: number, normalize = true): Padding {
    return { top: n, bottom: n, left: n*(normalize ? 2 : 1), right: n*(normalize ? 2 : 1) };
}

export function padding_down(n: number): Padding {
    return { top: 0, bottom: n, left: 0, right: 0 };
}

export function padding(top: number, bottom: number, left: number, right: number, normalize = true): Padding {
    return { top, bottom, left: (normalize?2:1)*left, right: (normalize?2:1)*right };
}

export function color(c: string | [number, number, number], c2?: string | [number, number, number]): Gradient {
    const col1 = (typeof(c) == 'string') ? parseHexColor(c) : c;
    const col2 = c2 ? ((typeof(c2) == 'string') ? parseHexColor(c2) : c2) : col1;
    return [col1, col2];
}

export type ItuiStyle = {
    w: Size,
    h: Size,
    fg: Gradient,
    bg: Gradient,
    padding: Padding,
    child_dir: Direction,
    centered: Direction,
    title: string
};

export type ContentNode = {
    id?: string,
    type: 'rect' | 'text' | 'image',
    style: Partial<ItuiStyle>,
    children: ContentNode[],
    content?: unknown
};

export type RenderCommand =
    { _id: string, type: 'rect', x: number, y: number, w: number, h: number, title?: string, bg?: Gradient } |
    { _id: string, type: 'text', x: number, y: number, text: string, fg?: Gradient, bg?: Gradient } |
    { _id: string, type: 'image', x: number, y: number, w: number, h: number, pixels: number[] } |
    { _id: string, type: 'test', x: number, y: number, w: number, h: number };

export class Itui {
    constructor() {

    }

    protected parseSize(size: Size = size_grow(), v: number): { v: number, type: 'consume' | 'grow' | 'shrink' } {
        switch(size.type) {
            case "percentage": return { v: Math.ceil(v * Math.min(size.val, 1)), type: 'consume' };
            case "grow": return { v, type: 'grow' };
            case "static": return { v: size.val, type: 'consume' };
        }
    }

    protected hPadding(size: { v: number, consume: boolean }, padding?: Padding) {
        if(!padding) return size;
        size.v -= padding.left + padding.right;
        // size.v -= (padding.left+padding.right);
        return size;
    }
    protected vPadding(size: { v: number, consume: boolean }, padding?: Padding) {
        if(!padding) return size;
        // size.v += padding.top + padding.bottom;
        // size.v -= (padding.left + padding.right);
        return size;
    }

    /**
     * Parse a node tree, returning a list of
     * renderer commands.
     * @param node The root node in a node tree to parse
     */
    layout(node: ContentNode, w: number, h: number, x: number, y: number) {
        let renderCommands: RenderCommand[] = [];

        const dir = node.style.child_dir ?? Direction.Horizontal;

        const cW = (node.style.w?.type == 'percentage') ? { v: w } : this.parseSize(node.style.w, w);
        const cH = (node.style.h?.type == 'percentage') ? { v: h } : this.parseSize(node.style.h, h);
        let cX = x;
        let cY = y;

        switch(node.type) {
            case 'rect':
                renderCommands.push({ _id: node.id ?? '?', type: 'rect', x: cX, y: cY, w: cW.v, h: cH.v, title: node.style.title, bg: node.style.bg }); // color([randomInt(0, 255),randomInt(0, 255),randomInt(0, 255)]);
            break;

            case 'text':
                renderCommands.push({ _id: node.id ?? '?', type: 'text', x: cX, y: cY, text: (node.content as string).slice(0, w), fg: node.style.fg });
            break;
        }

        cX += (node.style.padding?.left ?? 0);
        cY += (node.style.padding?.top ?? 0);

        cW.v -= (node.style.padding?.left ?? 0);
        cH.v -= (node.style.padding?.top ?? 0) + (node.style.padding?.bottom ?? 0);

        const padding_start = (dir == Direction.Horizontal) ? (node.style.padding?.right ?? 0) : (node.style.padding?.bottom ?? 0);
        const total_space = (dir == Direction.Horizontal) ? cW.v : cH.v;

        let free_space = total_space-padding_start;
        let used_space = 0;
        let grow_node_count = 0;

        for(let i=0;i<node.children.length;i++) {
            const s = (dir == Direction.Horizontal)
                ? this.parseSize(node.children[i].style.w, cW.v)
                : this.parseSize(node.children[i].style.h, cH.v)
            ;

            if(s.type == 'consume')   { free_space -= s.v; used_space += s.v; }
            else if(s.type == 'grow') grow_node_count++;
        }

        if((node.style.centered ?? 0) & Direction.Horizontal) {
            if(dir == Direction.Horizontal) cX += Math.ceil((total_space-used_space)/2);
            else                            cX += Math.floor(cW.v/2);
        }

        if((node.style.centered ?? 0) & Direction.Vertical) {
            if(dir == Direction.Vertical)   cY += Math.ceil((total_space-used_space)/2);
            else                            cY += Math.floor(cH.v/2);
        }

        for(let i=0;i<node.children.length;i++) {
            const s = (dir == Direction.Horizontal)
                ? this.parseSize(node.children[i].style.w, cW.v)
                : this.parseSize(node.children[i].style.h, cH.v)
            ;

            const size = ((s.type == 'consume') ? s.v : Math.ceil(free_space/grow_node_count));

            if(dir == Direction.Horizontal) {
                renderCommands = renderCommands.concat(
                    this.layout(
                        node.children[i],
                        size, cH.v, // -(node.style.padding?.right ?? 0)
                        cX, cY
                    )
                );
                cX += size;
            } else {
                renderCommands = renderCommands.concat(
                    this.layout(
                        node.children[i],
                        cW.v-(node.style.padding?.right ?? 0), size,
                        cX, cY,
                    )
                );
                cY += size + (node.children[i].style.padding?.bottom ?? 0);
            }
        }

        return renderCommands;
    }

    rectangle(style: Partial<ItuiStyle>, children?: ContentNode[], id?: string) {
        return {
            id, type: 'rect',
            style, children: children ?? []
        } as ContentNode;
    }

    text(style: Partial<ItuiStyle>, content: string, id?: string) {
        return {
            id, type: 'text',
            content,
            style: { w: size_static(content.length), h: size_static(1), ...style }, children: []
        } as ContentNode;
    }

    image(style: Partial<ItuiStyle>, id?: string) {
        return {
            id, type: 'image',
            style, children: []
        } as ContentNode;
    }
}