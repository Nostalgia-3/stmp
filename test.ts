// import { color, Gradient, Itui, padding_all, padding_down, size_grow, size_static } from './src/itui.ts';
// import { Renderer } from './src/renderer.ts';
// import * as utils from './src/utils.ts'

// const { columns: w, rows: h } = Deno.consoleSize();
// const ui = new Itui();

// const commands = ui.layout(
//     ui.rectangle('OuterContainer', {
//         w: size_grow(), h: size_grow(),
//         padding: padding_all(16),
//         bg: color('#FAFAFF')
//     }, [
//         ui.rectangle('SideBar', {
//             w: size_static(30), h: size_grow(),
//             bg: color('#505050'), padding: padding_all(1)
//         }, [
//             ui.image('AlbumArt', {
//                 padding: padding_down(1),
//                 w: size_grow(),
//                 h: size_grow()
//                 // TODO: figure out how this would actually work
//             }),
//             ui.text('TrackTitle', {
//                 fg: color(`#ffffff`),
//             }, `Song Title`),
//             ui.text('TrackArtists', {
//                 fg: color(`#808080`),
//             }, `Song Artists`)
//         ]),
//         ui.rectangle('MainContent', {
//             w: size_grow(), h: size_grow(),
//             bg: color('#FFFFFF')
//         }),
//     ]), w, h, 0, 0
// );

// const rend = new Renderer(w, h);
// // rend.clear(utils.grad([0,0,0]));
// for(let i=0;i<commands.length;i++) {
//     switch(commands[i].type) {
//         case 'text': {
//             const comm = commands[i] as { type: 'text', x: number, y: number, text: string, color: Gradient };
//             rend.text(comm.x, comm.y, comm.text, utils.rgb(comm.color.cols[0]));
//         break; }

//         case 'rect': {
//             const comm = commands[i] as { type: 'rect', x: number, y: number, w: number, h: number, color: Gradient };
//             rend.rect(comm.x, comm.y, comm.w, comm.h, utils.rgb(comm.color.cols[0]));
//         break; }
//     }
// }
// rend.flush();

// utils.write(utils.cursorTo(0, 0));  

// setInterval(()=>{});