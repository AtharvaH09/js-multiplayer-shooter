import { k } from "../App";
import addButton from "../UI/button";

export function createMainMenuScene(joinRoom: Function) {
    k.scene("main-menu", (joinRoom) => {
        const btn1 = addButton("Start", k.vec2(200, 100), joinRoom);
    });
}