// crosshair.ts
import { KAPLAYCtx } from "kaplay"

export function useCrosshair(k: KAPLAYCtx, color: "white" | "black" = "white") {
  // preload sprites (safe to call multiple times)
  k.loadSprite("crosshair_white", "public/assets/HUD/crosshairs_tilesheet_white.png", { sliceX: 20, sliceY: 10 })
  k.loadSprite("crosshair_black", "public/assets/HUD/crosshairs_tilesheet_black.png", { sliceX: 20, sliceY: 10 })

  const cursor = k.add([
    k.sprite(`crosshair_${color}`, { frame: 21 }),  // smg
    // k.sprite(`crosshair_${color}`, { frame: 67 }),  // sniper
    k.pos(k.mousePos()),
    k.z(1000),
    k.anchor("center"),
    k.fixed(),
  ])

  k.onUpdate(() => {
    cursor.pos = k.mousePos()
    k.setCursor("none")
  })

  return cursor
}
