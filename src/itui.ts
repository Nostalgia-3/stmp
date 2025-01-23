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

export function color(c: Color): Gradient {
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
    id: string,
    type: string,
    style: Partial<ItuiStyle>,
    children: ContentNode[],
    content: unknown
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
     * renderer commands
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
        
    }
}

/*

const ui = new Itui();

ui.layout(
    ui.rectangle('OuterContainer', {
        w: size_grow(), h: size_grow(),
        padding: padding_all(16), child_gap: 16,
        color: color([250, 250, 255])
    }, [
        ui.rectangle('MainContent', {
            w: size_grow(), h: size_grow(),
            color: color([255,255,255])
        }),
        ui.rectangle('SideBar', {
            w: size_static(30), h: size_grow(),
            color: color(`#505050`), padding: padding_all(1)
        }, [
            ui.image('AlbumArt', {
                padding: padding_down(1)
                // TODO: figure out how this would actually work
            }),
            ui.text('TrackTitle', {
                color: color(`white`),
                content: `Song Title`
            }),
            ui.text('TrackArtists', {
                color: color(`gray`),
                content: `Song Artists`
            })
        ])
    ])
);

*/