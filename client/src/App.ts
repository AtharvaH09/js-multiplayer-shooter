import './index.css';
import { GAME_HEIGHT, GAME_WIDTH } from "../../globals";
import kaplay from "kaplay";
import { colyseusSDK } from "./core/colyseus";
import { createLobbyScene } from './scenes/lobby';
import type { MyRoomState } from '../../server/src/rooms/schema/MyRoomState';
import addButton from './UI/button';
import { useCrosshair } from './UI/mouse_pointer';

// Initialize kaplay
export const k = kaplay({
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  letterbox: true,
  pixelDensity: Math.min(window.devicePixelRatio, 2), // crispier on phones
  // background: "20252e",
});

// Create all scenes
createLobbyScene();

async function joinRoom() {

  const text = k.add([
    k.text("Joining room ..."),
    k.pos(k.center()),
    k.anchor("center")
  ]);

  const room = await colyseusSDK.joinOrCreate<MyRoomState>("my_room", {
    name: "Ka"
  });

  text.text = "Success! sessionId: " + room.sessionId;

  k.go("lobby", room);
}

async function main() {
  const btn1 = addButton("Start", k.vec2(200, 100), joinRoom);
  // useCrosshair(k, "white");
}

main();
