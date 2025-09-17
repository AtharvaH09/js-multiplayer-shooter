import { k } from "../App";

export function loadAssets() {
  k.loadSprite("title", "/title.svg");
  
  // Player spritesheet (9 rows × 3 columns)
  k.loadSprite("all_avatars", "/assets/player/neo_zero_char_01.png", {
    sliceX: 3,
    sliceY: 9,
    anims: {
      "idle-down": 1,
      "walk-down": { from: 0, to: 2, speed: 5, pingpong: true, loop: true },
      "idle-up": 4,
      "walk-up": { from: 3, to: 5, speed: 5, pingpong: true, loop: true },
      "idle-side": 7,
      "walk-side": { from: 6, to: 8, speed: 5, pingpong: true, loop: true },
    },
  });

  // Gun sprite
  k.loadSprite("gun", "/assets/gun.png");

  // Reload spinner (HUD element)
  k.loadSprite("reloadSpinner", "/assets/HUD/Spinner1.png", {
    sliceX: 4,
    sliceY: 3,
    anims: {
      spin: { from: 0, to: 11, speed: 20, loop: true },
    },
  });

  // VFX (for hit effects, death particles, etc.)
  k.loadSprite("hexagon", "/assets/vfx/particle_hexagon_filledB.png");
  k.loadSprite("star", "/assets/vfx/particle_star_filled.png");

  // Audio
  k.loadSound("m1911-shoot", "/assets/sounds/m1911-shoot.mp3");
  k.loadSound("m1911-reload", "/assets/sounds/m1911-reload.mp3");
  k.loadSound("m1911-empty-shoot", "/assets/sounds/empty-gun-shot-6209.mp3");

  // Maps are loaded dynamically based on room data
}
