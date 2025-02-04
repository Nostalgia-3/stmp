import { interpolate, parseHexColor } from "./utils.ts";

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

export function padding_all(n: number, normalize = false): Padding {
    return { top: n, bottom: n, left: n*(normalize ? 2 : 1), right: n*(normalize ? 2 : 1) };
}

export function padding_down(n: number): Padding {
    return { top: 0, bottom: n, left: 0, right: 0 };
}

export function padding_right(n: number, normalize = false): Padding {
    return { top: 0, bottom: 0, left: 0, right: n*(normalize?2:1) };
}

export function padding(top: number, bottom: number, left: number, right: number, normalize = true): Padding {
    return { top, bottom, left: (normalize?2:1)*left, right: (normalize?2:1)*right };
}

export function color(start: string | [number, number, number], end?: string | [number, number, number]): Gradient {
    const col1 = (typeof(start) == 'string') ? parseHexColor(start) : start;
    const col2 = end ? ((typeof(end) == 'string') ? parseHexColor(end) : end) : col1;
    return [col1, col2];
}

export type ItuiStyle = {
    w: Size,
    h: Size,
    fg: Gradient,
    bg: Gradient,
    padding: Padding,
    child_dir: Direction,
    child_padding: number,
    centered: Direction,
    /**
     * Whether the element is clickable
     */
    clickable: boolean,
    title: string,
    thin: boolean,
    /**
     * Look at something like the flex-grow in CSS to better
     * understand what this does
     */
    grow: number
};

export type ContentNode = {
    id?: string,
    type: 'panel' | 'scrollPanel' | 'text' | 'image' | 'hprogress' | 'vscrollbar' | 'button',
    style: Partial<ItuiStyle>,
    children: ContentNode[],
    content?: unknown
};

export type SizeNode = {
    x: number, y: number, w: number, h: number,
    children: SizeNode[]
} & ContentNode;

export type RenderCommand =
    { _id: string, type: 'rect', x: number, y: number, w: number, h: number, title?: string, bg?: Gradient } |
    { _id: string, type: 'text', x: number, y: number, text: string, fg?: Gradient, bg?: Gradient } |
    { _id: string, type: 'image', x: number, y: number, w: number, h: number, pixels: number[] } |
    { _id: string, type: 'vline', x: number, y: number, w: number, h: number, fg?: Gradient, bg?: Gradient };

export class Itui {
    protected parseSize(size: Size = size_grow(), v: number): { v: number, type: 'consume' | 'grow' | 'shrink' } {
        switch(size.type) {
            case "percentage": return { v: Math.ceil(v * Math.min(size.val, 1)), type: 'consume' };
            case "grow": return { v, type: 'grow' };
            case "static": return { v: size.val, type: 'consume' };
        }
    }

    constructor() {

    }

    /**
     * Parse a node tree, returning a node tree with data included
     * @returns 
     */
    layout(w: number, h: number, x: number, y: number, node: ContentNode, pbg?: Gradient): SizeNode {
        let sNode: SizeNode;

        if(node.style.title) {
            if(!node.style.padding) node.style.padding = { left: 0, top: 0, bottom: 0, right: 0 };
            node.style.padding.left++;
            node.style.padding.right++;
            node.style.padding.top++;
            node.style.padding.bottom++;
        };

        const dir = node.style.child_dir ?? Direction.Horizontal;

        const cW = (node.style.w?.type == 'percentage') ? { v: w } : this.parseSize(node.style.w, w);
        const cH = (node.style.h?.type == 'percentage') ? { v: h } : this.parseSize(node.style.h, h);
        let cX = x;
        let cY = y;

        switch(node.type) {
            case 'panel':
            case 'text':
            case 'hprogress':
            case 'vscrollbar':
            case 'scrollPanel':
            case 'button':
            case 'image':
                sNode = ({ ...node, children: [], x: cX, y: cY, w: cW.v, h: cH.v }) as SizeNode;
            break;

            default:
                sNode = ({ type: 'panel', id: node.id, x: cX, y: cY, w: cW.v, h: cH.v, children: [], style: { ...node.style, bg: undefined } });
            break;
        }

        cX += (node.style.padding?.left ?? 0);
        cY += (node.style.padding?.top ?? 0);

        cW.v -= (node.style.padding?.left ?? 0) + (node.style.padding?.right ?? 0);
        cH.v -= (node.style.padding?.top ?? 0) + (node.style.padding?.bottom ?? 0);

        const total_space = (dir == Direction.Horizontal) ? cW.v : cH.v;
        const paddingUsed = (dir == Direction.Horizontal) ? (node.style.padding?.left??0) : (node.style.padding?.top??0);

        let free_space = total_space-paddingUsed-(node.style.child_padding??0)*node.children.length;
        let used_space = 0;
        let grow_node_count = 0;

        for(let i=0;i<node.children.length;i++) {
            const s = (dir == Direction.Horizontal)
                ? this.parseSize(node.children[i].style.w, cW.v)
                : this.parseSize(node.children[i].style.h, cH.v)
            ;

            if(s.type == 'consume')   { free_space -= s.v; used_space += s.v; }
            else if(s.type == 'grow') grow_node_count+=(node.children[i].style.grow ?? 1);
        }

        if((node.style.centered ?? 0) & Direction.Horizontal) {
            if(dir == Direction.Horizontal) { cX += Math.floor((total_space-used_space)/2); }
            else                            { cX += Math.floor((cW.v)/2); }
        }

        if((node.style.centered ?? 0) & Direction.Vertical) {
            if(dir == Direction.Vertical)   cY += Math.floor((total_space-used_space)/2);
            else                            cY += Math.floor((cH.v)/2);
        }

        let sPercentage = 0;
        for(let i=0;i<node.children.length;i++) {
            const s = (dir == Direction.Horizontal)
                ? this.parseSize(node.children[i].style.w, cW.v)
                : this.parseSize(node.children[i].style.h, cH.v)
            ;

            const size = ((s.type == 'consume') ? s.v : Math.floor(((node.children[i].style.grow??1)/grow_node_count)*free_space));

            // This is REALLY bad; it completely scrolls past full elements,
            // which is not what should happen (e.g. a panel within a
            // scrollpanel will virtually disappear if the scroll level is too 
            // high)
            if(node.type == 'scrollPanel') {
                if(sPercentage < (node.content as number)) {
                    sPercentage += (size);
                    continue;
                }
            }

            if(dir == Direction.Horizontal) {
                sNode.children.push(this.layout(
                    (size+cX > w) ? (w - (size+cX)) : size, cH.v,
                    cX, cY,
                    node.children[i]
                ));
                cX += size;
                cX += node.style.child_padding ?? 0;
            } else {
                if((i-sPercentage) < cH.v) {
                    sNode.children.push(this.layout(
                        cW.v, size,
                        cX, cY,
                        node.children[i]
                    ));
                }
                cY += size;
                cY += node.style.child_padding ?? 0;
            }
        }

        return sNode;
    }

    getElementById(nt: SizeNode, id: string): SizeNode | undefined {
        if(nt.id == id) {
            return nt;
        } else {
            for(let i=0;i<nt.children.length;i++) {
                const t = this.getElementById(nt.children[i], id);
                if(t) return t;
            }
        }
    }

    /**
     * Check if a point is within the node passed.
     * @param node The node to check
     * @param x The X position
     * @param y The Y position
     */
    inRange(node: SizeNode, x: number, y: number): boolean {
        if(
            x >= node.x && x <= node.x+node.w &&
            y >= node.y && y <= node.y+node.h
        ) return true;
        return false;
    }

    /**
     * Parse a computed node tree, producing render commands
     * @param node The root node in a node tree to parse
     */
    draw(node: SizeNode): RenderCommand[] {
        let renderCommands: RenderCommand[] = [];

        if(node.w > 0 && node.h > 0)
        switch(node.type) {
            case 'scrollPanel':
            case 'panel':
                renderCommands.push({ _id: node.id ?? '?', type: 'rect', x: node.x, y: node.y, w: node.w, h: node.h, title: node.style.title, bg: node.style.bg });
            break;

            case 'text':
                renderCommands.push({ _id: node.id ?? '?', type: 'text', x: node.x, y: node.y, text: `${(node.content as string).slice(0, node.w)}`, fg: node.style.fg });
            break;

            case 'hprogress': {
                const [done, total] = node.content as [number, number];

                if(node.style.thin) {
                    renderCommands.push({ _id: node.id ?? '?', type: 'vline', x: node.x, y: node.y, w: node.w, h: node.h, fg: node.style.bg });
                    renderCommands.push({ _id: node.id ?? '?', type: 'vline', x: node.x, y: node.y, w: Math.floor(node.w*(done/(total??1))), h: node.h, fg: node.style.fg });
                } else {
                    renderCommands.push({ _id: node.id ?? '?', type: 'rect', x: node.x, y: node.y, w: node.w, h: node.h, bg: node.style.bg });
                    renderCommands.push({ _id: node.id ?? '?', type: 'rect', x: node.x, y: node.y, w: Math.floor(node.w*(done/(total??1))), h: node.h, bg: node.style.fg });
                }
            break; }

            case 'vscrollbar': {
                // this.rend.text(
                //     Math.floor((this.ui.bottomBarWidth-Math.floor(this.ui.bottomBarWidth/2))/2),
                //     this.ui.trackHeight+Math.floor(this.ui.bottomBarHeight/2),
                //     ''.padEnd(Math.floor(this.ui.bottomBarWidth/2 * this.player.getPosition()/(this.player.getTotalLength() ?? 1)), this.ui.playbar_fillchar),
                //     this.ui.playbar_fillcolor
                // );

                // const percentScrolled = (this.trackOff)/(this.tracks.length);
                // const size = Math.floor((this.ui.trackHeight-2)/this.tracks.length*(this.ui.trackHeight-2));
                // const offset = Math.ceil((this.ui.trackHeight-2) * percentScrolled);
                // this.rend.vline(this.ui.trackWidth-2, 1, this.ui.trackHeight-2, sfg, undefined, '▐');
                // this.rend.vline(this.ui.trackWidth-2, 1+offset, size, pfg, undefined, '▐');
            break; }

            case 'button': {
                renderCommands.push({ _id: node.id ?? '?', type: 'rect', x: node.x+1, y: node.y, w: node.w-2, h: node.h, bg: node.style.bg });
                renderCommands.push({ _id: node.id ?? '?', type: 'text', x: node.x, y: node.y, text: `\ue0b6${''.padStart((node.content as string).length)}\ue0b4`, fg: node.style.bg });
                renderCommands.push({ _id: node.id ?? '?', type: 'text', x: node.x+1, y: node.y, text: `${node.content as string}`, fg: node.style.fg });
            break; }
        }

        for(let i=0;i<node.children.length;i++) {
            renderCommands = renderCommands.concat(this.draw(node.children[i]));
        }

        return renderCommands;
    }

    protected i_click(nt: SizeNode, x: number, y: number) {
        let nodesClicked: SizeNode[] = [];

        if(
            x >= nt.x && x <= nt.x+nt.w &&
            y >= nt.y && y <= nt.y+nt.h
        ) {
            if(nt.style.clickable ?? true) nodesClicked.push(nt);
            for(let i=0;i<nt.children.length;i++) {
                nodesClicked = nodesClicked.concat(this.i_click(nt.children[i], x, y) as unknown as SizeNode[]);
            }
        }

        return nodesClicked;
    }

    /**
     * Finds the "highest" element at a position, and returns it
     * @param nt The node tree
     * @param x The X coordinate of the click
     * @param y The Y coordinate of the click
     * @returns 
     */
    click(nt: SizeNode, x: number, y: number) {
        return this.i_click(nt, x, y).at(-1);
    }

    /**
     * A horizontal slider
     * @param style The style of this element
     * @param fill The amount (in a decimal percentage) scrolled
     * @param count The amount of elements for the slider
     * @param id The id of this element
     */
    hprogress(style: Partial<ItuiStyle>, done: number, total: number, id?: string) {
        return {
            id, type: 'hprogress',
            style, children: [],
            content: [done, total]
        } as ContentNode;
    }

    /**
     * A generic panel that can contain children.
     * @param style The style of the panel
     * @param children The children of the panel
     * @param id The id of the panel
     */
    panel(style: Partial<ItuiStyle>, children?: ContentNode[], id?: string) {
        return {
            id, type: 'panel',
            style, children: children ?? []
        } as ContentNode;
    }

    /**
     * A button
     * @param style 
     * @param content 
     * @param id 
     */
    button(style: Partial<ItuiStyle>, content: string, id?: string) {
        return {
            id, type: 'button',
            content,
            style: { ...style, w: size_static(content.length+2) }, children: []
        } as ContentNode;
    }

    /**
     * A scrollable panel
     * @param style The style of the panel
     * @param scroll the amount the panel has been scrolled
     * @param children The children of the panel
     * @param id The identifier
     */
    scrollPanel(style: Partial<ItuiStyle>, scroll: number, children?: ContentNode[], id?: string) {
        return {
            id, type: 'scrollPanel',
            style, children: children ?? [],
            content: scroll
        } as ContentNode;
    }

    /**
     * A text element
     * @param style The style of the string
     * @param content The contents of the string
     * @param id The id of the text
     */
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