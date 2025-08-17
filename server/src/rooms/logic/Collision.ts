export default function getCollisionRects(mapData: any) {
  const colliders: { x: number, y: number, w: number, h: number }[] = [];
  for (const layer of mapData.layers) {
    if (layer.name === "Colliders" && layer.objects) {
      for (const obj of layer.objects) {
        colliders.push({
          x: obj.x,
          y: obj.y,
          w: obj.width,
          h: obj.height,
        });
      }
    }
  }
  return colliders;
}