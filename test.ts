import { color, Gradient, Itui, padding_all, padding_down, size_grow, size_static } from './src/itui.ts';
import { Renderer } from './src/renderer.ts';
import * as utils from './src/utils.ts'

const { columns: w, rows: h } = Deno.consoleSize();
const ui = new Itui();

const commands = ui.layout(
    ui.rectangle('OuterContainer', {
        w: size_grow(), h: size_grow(),
        padding: padding_all(16),
        bg: color('#FAFAFF')
    }, [
        ui.rectangle('MainContent', {
            w: size_grow(), h: size_grow(),
            bg: color('#FFFFFF')
        }),

        ui.rectangle('SideBar', {
            w: size_static(30), h: size_grow(),
            bg: color('#505050'), padding: padding_all(1)
        }, [
            ui.image('AlbumArt', {
                padding: padding_down(1),
                w: size_grow(),
                h: size_grow()
                // TODO: figure out how this would actually work
            }),
            ui.text('TrackTitle', {
                fg: color(`#ffffff`),
            }, `Song Title`),
            ui.text('TrackArtists', {
                fg: color(`#808080`),
            }, `Song Artists`)
        ]),
    ]), w, h, 0, 0
);

console.log(commands.c);
Deno.exit();

// const rend = new Renderer(w, h);
// rend.clear(utils.grad([0,0,0]));
// for(const command of commands.c) {
//     switch(command.type) {
//         case 'text': {
//             const comm = command as { type: 'text', x: number, y: number, text: string, color: Gradient };
//             rend.text(comm.x, comm.y, comm.text, [comm.color.cols[0],comm.color.cols[0]] as utils.Gradient);
//         break; }

//         case 'rect': {
//             const comm = command as { type: 'rect', x: number, y: number, w: number, h: number, color: Gradient };
//             rend.rect(comm.x, comm.y, comm.w, comm.h, [comm.color.cols[0],comm.color.cols[0]] as utils.Gradient);
//         break; }
//     }
// }
// rend.draw();
// utils.write(utils.cursorTo(0, 0));
// setInterval(()=>{});