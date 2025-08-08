import { k } from "../App";

export const level = k.addLevel([
    "@  =  $",
    "=======",
], {
    tileWidth: 64,
    tileHeight: 64,
    pos: k.vec2(100, 200),
    tiles: {
        "@": () => [
            k.sprite("bean"),
            k.area(),
            k.body(),
            k.anchor("bot"),
            "player",
        ],
        "=": () => [
            k.sprite("grass"),
            k.area(),
            k.body({ isStatic: true }),
            k.anchor("bot"),
        ],
        "$": () => [
            k.sprite("coin"),
            k.area(),
            k.anchor("bot"),
            "coin",
        ],
    },
});