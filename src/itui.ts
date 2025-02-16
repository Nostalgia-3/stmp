import { parseHexColor } from "./utils.ts";

export type Color       = [number, number, number];
export type Gradient    = [Color, Color];

export enum Direction {
    Horizontal  = 0b01,
    Vertical    = 0b10
}

export class Size {
    type: 'percentage' | 'grow' | 'static';
    val: number;

    protected constructor(type: 'percentage' | 'grow' | 'static', val: number) {
        this.type = type;
        this.val = val;
    }

    static static(c: number) {
        return new Size('static', c);
    }

    static percentage(c: number) {
        return new Size('percentage', c/100);
    }

    static grow() { return new Size('grow', 0); }
}

export class Padding {
    top: number;
    bottom: number;
    left: number;
    right: number;

    protected constructor(top: number, bottom: number, left: number, right: number, normalize: boolean) {
        this.top = top;
        this.bottom = bottom;
        this.left = left*(normalize ? 2 : 1);
        this.right = right*(normalize ? 2 : 1);
    }

    static all(top: number, bottom: number, left: number, right: number, normalize = false) {
        return new Padding(top, bottom, left, right, normalize);
    }
    static same(n: number, normalize = false)   { return new Padding(n, n, n, n, normalize); }
    static top(n: number)                       { return new Padding(n, 0, 0, 0, false); }
    static down(n: number)                      { return new Padding(0, n, 0, 0, false); }
    static left(n: number, normalize = false)   { return new Padding(0, 0, n, 0, normalize); }
    static right(n: number, normalize = false)  { return new Padding(0, 0, 0, n, normalize); }
}

export function color(start: string | [number, number, number], end?: string | [number, number, number]): Gradient {
    const col1 = (typeof(start) == 'string') ? parseHexColor(start) : start;
    const col2 = end ? ((typeof(end) == 'string') ? parseHexColor(end) : end) : col1;
    return [col1, col2];
}

export type ItuiStyle = {
    /**
     * The width of the element (using size_* functions)
     */
    w: Size,

    /**
     * The height of the element
     */
    h: Size,
    /**
     * The foreground color of the element 
     */
    fg: Gradient,

    /**
     * The background color of the element
     */
    bg: Gradient,

    /**
     * The padding of the element
     */
    padding: Padding,

    /**
     * The direction child elements are laid out
     */
    child_dir: Direction,

    /**
     * The amount of padding between every child element
     */
    child_padding: number,
    
    /**
     * The direction elements are centered (can be or-ed)
     */
    centered: Direction,
    
    /**
     * Whether the element is clickable
     */
    clickable: boolean,
    
    /**
     * The title on panels
     */
    title: string,
    
    /**
     * Whether an element should be drawn thinner or thicker
     */
    thin: boolean,

    /**
     * Look at something like the flex-grow in CSS to better
     * understand what this does
     */
    grow: number,

    /**
     * If specified, the location chosen will be the middle point
     * for a floating node tree
     */
    position: [Size, Size],

    /**
     * The 3rd coordinate determining the position from the back to the front
     * (higher means more forward)
     */
    z: number
};

/**
 * A generic content node created by the `Element` methods
 */
export type ContentNode = {
    id?: string,
    type: 'panel' | 'scrollPanel' | 'text' | 'image' | 'hprogress' | 'vscrollbar' | 'button',
    style: Partial<ItuiStyle>,
    children: ContentNode[],
    content?: unknown
};

/**
 * A content node with a size and width appended to it. These are generated by
 * the `Itui.prototype.layout()` method.
 */
export type SizeNode = {
    x: number, y: number, w: number, h: number,
    children: SizeNode[]
} & ContentNode;

/**
 * Render commands created by the `Itui.prototype.draw()` function
 */
export type RenderCommand
    = { _id: string, z: number, type: 'rect', x: number, y: number, w: number, h: number, title?: string, bg?: Gradient }
    | { _id: string, z: number, type: 'text', x: number, y: number, text: string, fg?: Gradient, bg?: Gradient }
    | { _id: string, z: number, type: 'image', x: number, y: number, w: number, h: number, pixels: number[] }
    | { _id: string, z: number, type: 'vline', x: number, y: number, w: number, h: number, fg?: Gradient, bg?: Gradient }
;

export class Itui {
    protected parseSize(size: Size = Size.grow(), v: number): { v: number, type: 'consume' | 'grow' | 'shrink' } {
        switch(size.type) {
            case "percentage": return { v: Math.floor(v * Math.min(size.val, 1)), type: 'consume' };
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
    layout(w: number, h: number, x: number, y: number, node: ContentNode): SizeNode {
        let sNode: SizeNode;

        if(node.style.title) {
            if(!node.style.padding) node.style.padding = { left: 0, top: 0, bottom: 0, right: 0 };
            node.style.padding.left++;
            node.style.padding.right++;
            node.style.padding.top++;
            node.style.padding.bottom++;
        };

        const dir = node.style.child_dir ?? Direction.Horizontal;

        const cW = this.parseSize(node.style.w, w); // (node.style.w?.type == 'percentage') ? { v: w }
        const cH = this.parseSize(node.style.h, h);
        let cX = x;
        let cY = y;

        if(node.style.position) {
            // floating window; ignore all the rules and put wherever we want!!!
            cX = Math.ceil((this.parseSize(node.style.position[0], w).v)/2);
            cY = Math.ceil((this.parseSize(node.style.position[1], h).v)/2);
        }

        switch(node.type) {
            case 'panel':
            case 'hprogress':
            case 'vscrollbar':
            case 'scrollPanel':
            case 'button':
            case 'image':
                sNode = ({ ...node, children: [], x: cX, y: cY, w: cW.v, h: cH.v }) as SizeNode;
            break;

            case 'text':
                sNode = ({ ...node, children: [], x: cX, y: cY, w: cW.v, h: cH.v }) as SizeNode;
                sNode.content = (sNode.content as string).slice(0, Math.max(cW.v, w));
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

        let free_space = total_space-paddingUsed-(node.style.child_padding??0)*(node.children.filter((v)=>!v.style.position).length);
        let used_space = 0;
        let grow_node_count = 0;

        for(let i=0;i<node.children.length;i++) {
            if(node.children[i].style.position) continue;

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

            node.children[i].style.z = (node.children[i].style.z ?? 0) + (node.style.z ?? 0);
            node.children[i].style.fg = (node.children[i].style.fg ?? node.style.fg);

            let size = ((s.type == 'consume') ? s.v : Math.floor(((node.children[i].style.grow??1)/grow_node_count)*free_space));

            // This is REALLY bad; it completely scrolls past full elements,
            // which is not what should happen (e.g. a panel within a
            // scrollpanel will virtually disappear if the scroll level is too 
            // high)
            if(node.type == 'scrollPanel') {
                if(sPercentage < (node.content as number)) {
                    sPercentage++;
                    size--;
                }
            }

            let width: number;
            let height: number;

            if(dir == Direction.Horizontal) {
                width = (size+cX > w) ? (w - (size+cX)) : size;
                height = cH.v;
            } else {
                width = cW.v;
                height = size;
            }

            if(node.children[i].style.position) {
                width = w;
                height = h;
            }

            if(dir == Direction.Horizontal || (dir == Direction.Vertical && (i-sPercentage) < cH.v)) {
                sNode.children.push(this.layout(
                    width, height,
                    cX, cY,
                    node.children[i]
                ));
            }

            if(!node.children[i].style.position) {
                if(dir == Direction.Horizontal) {
                    cX += size + (node.style.child_padding ?? 0);
                } else {
                    cY += size + (node.style.child_padding ?? 0);
                }
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
                renderCommands.push({ _id: node.id ?? '?', z: node.style.z ?? 0, type: 'rect', x: node.x, y: node.y, w: node.w, h: node.h, title: node.style.title, bg: node.style.bg });
            break;

            case 'text':
                renderCommands.push({ _id: node.id ?? '?', z: node.style.z ?? 0, type: 'text', x: node.x, y: node.y, text: `${(node.content as string)}`, fg: node.style.fg, bg: node.style.bg });
            break;

            case 'hprogress': {
                const [done, total] = node.content as [number, number];

                if(node.style.thin) {
                    renderCommands.push({ _id: node.id ?? '?', z: node.style.z ?? 0, type: 'vline', x: node.x, y: node.y, w: node.w, h: node.h, fg: node.style.bg });
                    renderCommands.push({ _id: node.id ?? '?', z: node.style.z ?? 0, type: 'vline', x: node.x, y: node.y, w: Math.floor(node.w*(done/(total??1))), h: node.h, fg: node.style.fg });
                } else {
                    renderCommands.push({ _id: node.id ?? '?', z: node.style.z ?? 0, type: 'rect', x: node.x, y: node.y, w: node.w, h: node.h, bg: node.style.bg });
                    renderCommands.push({ _id: node.id ?? '?', z: node.style.z ?? 0, type: 'rect', x: node.x, y: node.y, w: Math.floor(node.w*(done/(total??1))), h: node.h, bg: node.style.fg });
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
                renderCommands.push({ _id: node.id ?? '?', z: node.style.z ?? 0, type: 'rect', x: node.x+1, y: node.y, w: node.w-2, h: node.h, bg: node.style.bg });
                renderCommands.push({ _id: node.id ?? '?', z: node.style.z ?? 0, type: 'text', x: node.x, y: node.y, text: `\ue0b6${''.padStart((node.content as string).length)}\ue0b4`, fg: node.style.bg });
                renderCommands.push({ _id: node.id ?? '?', z: node.style.z ?? 0, type: 'text', x: node.x+1, y: node.y, text: `${node.content as string}`, fg: node.style.fg });
            break; }
        }

        for(let i=0;i<node.children.length;i++) {
            renderCommands = renderCommands.concat(this.draw(node.children[i]));
        }

        return renderCommands;
    }

    protected i_click(n: SizeNode, x: number, y: number) {
        let nodesClicked: SizeNode[] = [];

        const nt = Object.assign({}, n);
        nt.children.sort((a,b)=>((a.style.z??0)-(b.style.z??0)));

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

    /* Elements */

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
            style: { ...style, w: Size.static(content.length+2) }, children: []
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
            style: { w: Size.static(content.length), h: Size.static(1), ...style }, children: []
        } as ContentNode;
    }

    /**
     * An image element
     * @param style The style of the string
     * @param id The id of the text
     */
    image(style: Partial<ItuiStyle>, id?: string) {
        return {
            id, type: 'image',
            style, children: []
        } as ContentNode;
    }
}