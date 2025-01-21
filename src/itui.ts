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

export class Itui {
    constructor() {

    }

    begin() {

    }

    rectangle(style: Partial<ItuiStyle>) {
        
    }

    end() {

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
            color: color()
        })
    ])
);

*/