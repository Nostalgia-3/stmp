import { Tag } from './src/id3.ts';
import { padding } from './src/itui.ts';
import { size_percentage } from './src/itui.ts';
import { color, Direction, Gradient, Itui, ItuiStyle, padding_all, padding_down, size_grow, size_static } from './src/itui.ts';
import { Renderer } from './src/renderer.ts';
import * as utils from './src/utils.ts'

const { columns: w, rows: h } = Deno.consoleSize();
const ui = new Itui();

const track: Partial<ItuiStyle> = {
    fg: color('#FFF'),
    padding: padding(0, 0, 0, 1, false),
    w: size_static(30)
}

const selectedTrack: Partial<ItuiStyle> = {
    fg: color('#000')
}

type Track = {
    tag?:       Tag,
    file:       string
};

const tracks: Track[] = [
    { tag: { artists: ['abc'] }, file: 'Track #1' },
    { tag: { artists: ['abc'] }, file: 'Track #2' },
    { tag: { artists: ['abc'] }, file: 'A third track!' }
];

const nt = ui.layout(
    w, h, 0, 0,
    ui.panel({
        child_dir: Direction.Vertical,
        // bg: color("#7851A9", "#857d9c")
        bg: color([97, 67, 133], [81, 99, 149]) // '#232526', '#414345'
    }, [
        ui.panel({}, [
            ui.panel({
                child_dir: Direction.Horizontal,
                padding: padding_all(1, false),
                title: 'Tracks'
            }, [
                ui.panel({
                    child_dir: Direction.Vertical
                }, [
                    // ui.rectangle({ w: size_grow(), h: size_static(1), bg: color('#FFF') }, [ ui.text(selectedTrack, 'Selected track') ], 'selected'),
                    ...tracks.map((v)=>ui.panel({ h: size_static(1) }, [ ui.text(track, v.file), ui.text({...track, w: size_grow(), padding: padding_all(0)}, v.tag?.artists?.join(', ') ?? '') ]))
                ]),
                ui.panel({
                    w: size_static(1),
                }),
                ui.panel({
                    w: size_static(1),
                    bg: color('#808080')
                })
            ], `Tracks`),
            ui.panel({
                w: size_static(30),
                padding: padding_all(1),
                child_dir: Direction.Vertical,
                title: 'Active'
            }, [
                ui.panel({
                    padding: padding_down(1),
                    centered: Direction.Horizontal,
                    w: size_static(26),
                    h: size_static(12),
                    bg: color('#323232')
                }, undefined, 'ImageTodo'),
                ui.text({
                    fg: color(`#ffffff`),
                }, `Song Title`, 'artist'),
                ui.text({
                    fg: color(`#808080`),
                }, `Artist`, 'artist'),
            ], 'SideBar'),
        ]),
        ui.panel({
            h: size_static(4),
            centered: Direction.Horizontal | Direction.Vertical
        }, [
            ui.text({ fg: color('#FFF') }, '0:00'),
            ui.panel({ bg: color('#FFF'), w: size_percentage(50), h: size_static(1) }, [], 'volume'),
            ui.text({ fg: color('#FFF') }, '1:00'),
        ])
    ], 'OuterContainer'),
);

function printSizeTree(s: Record<string, unknown>, indent = 0) {
    console.log(`${''.padStart(indent)}${s.id ?? 'unknown'}(x=${s.x}, y=${s.y}, w=${s.w}, h=${s.h}, type=${s.type}, children=${(s.children as Record<string,unknown>[])?.length})`);
    for(let i=0;i<((s.children as Record<string, unknown>[])?.length ?? 0);i++) {
        printSizeTree((s.children as Record<string, unknown>[])[i], indent + 2);
    }
}

printSizeTree(nt);

const commands = ui.draw(nt);
const rend = new Renderer(w, h);
rend.clear(utils.grad([0,0,0]));
for(const command of commands) {
    try {
        switch(command.type) {
            case 'text': {
                const comm = command as { type: 'text', x: number, y: number, text: string, fg?: Gradient, bg?: Gradient };
                rend.text(comm.x, comm.y, comm.text, comm.fg);
            break; }
                
            case 'rect': {
                const comm = command as { type: 'rect', x: number, y: number, w: number, h: number, title?: string, bg?: Gradient };
                if(comm.title)
                    rend.box(comm.x, comm.y, comm.w, comm.h, comm.title, color('#FFF'), comm.bg);
                else
                rend.rect(comm.x, comm.y, comm.w, comm.h, comm.bg);
            break; }
        }
    } catch(e) {
        console.log(command);
        throw e;
    }
}
rend.draw();
utils.write(utils.cursorTo(0, 0));
setInterval(()=>{});