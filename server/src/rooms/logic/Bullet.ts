type Bullet = {
  baseDamage: number;
  minDamage: number;
  maxRange: number;
}

export function calculateDamage(bullet: Bullet, distance: number): number {
  if (distance >= bullet.maxRange) {
    return bullet.minDamage;
  }

  // Linear falloff (simplest model)
  const falloff = (bullet.baseDamage - bullet.minDamage) * (distance / bullet.maxRange);
  return Math.max(bullet.minDamage, bullet.baseDamage - falloff);
}
