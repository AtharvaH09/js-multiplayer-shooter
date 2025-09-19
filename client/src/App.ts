import './index.css';
import { GAME_HEIGHT, GAME_WIDTH } from "../../globals";
import kaplay from "kaplay";
import { colyseusSDK } from "./core/colyseus";
import { createLobbyScene } from './scenes/lobby';
import type { MyRoomState } from '../../server/src/rooms/schema/MyRoomState';
import addButton from './UI/button';
import { useCrosshair } from './UI/mouse_pointer';
import { loadAssets } from './utils/loadAssets';

// Initialize kaplay
export const k = kaplay({
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  letterbox: true,
  pixelDensity: Math.min(window.devicePixelRatio, 2), // crispier on phones
  background: "20252e",
});

// Preload all assets
loadAssets();

// Create all scenes
createLobbyScene();

async function getPlayerProfile() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const res = await fetch("http://localhost:5555/players/profile", {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch profile:", err);
    return null;
  }
}


// Read token from URL or localStorage
const urlParams = new URLSearchParams(window.location.search);
const tokenFromUrl = urlParams.get("token");
const guestFlag = urlParams.get("guest");

if (tokenFromUrl) {
  localStorage.setItem("token", tokenFromUrl);
}
if (guestFlag) {
  localStorage.removeItem("token"); // enforce guest mode
}

async function joinRoom() {
  const text = k.add([
    k.text("Joining room ..."),
    k.pos(k.center()),
    k.anchor("center")
  ]);

  // Fetch player data before joining
  const profile = await getPlayerProfile();

  const room = await colyseusSDK.joinOrCreate<MyRoomState>("my_room", {
    token: localStorage.getItem("token"), // still send token for sanity
    playerData: profile ? {
      id: profile._id,
      username: profile.username,
      matchesPlayed: profile.matchesPlayed
    } : {
      id: "",
      username: `Guest-${Date.now()}`,
      matchesPlayed: 0
    }
  });

  text.text = "Success! sessionId: " + room.sessionId;

  k.go("lobby", room);
}

async function main() {
  k.scene("main-menu", () => {
    const startBtn = addButton("Start", k.vec2(200, 100), joinRoom);
    const ExitBtn = addButton("Exit", k.vec2(200, 200), () => window.location.assign("http://localhost:3000/client/launcher.html"));
  });
  k.go("main-menu");
}

main();