import { Schema, MapSchema, type } from '@colyseus/schema';

export class Gun extends Schema {
	@type('string') name: string = "pistol";
	@type('number') ammo: number = 30;
	@type('number') reserveAmmo: number = 90;
	@type('number') magSize: number = 30;
	@type('number') fireRate: number;
	@type('boolean') isReloading: boolean = false;
}

export class Player extends Schema {
	@type('string') public sessionId: string;
	@type('string') public userId: string;
	@type('string') public avatar: string;
	@type('string') public name: string;
	@type("number") public x: number = 0;
	@type("number") public y: number = 0;
	@type("number") public spawn: number;
	@type("number") public health: number = 100;
	@type("number") public maxHealth: number = 100;
	@type("boolean") public isAlive: boolean = true;
	@type("boolean") public isInvincible: boolean = false;
	@type("string") public team: "blue" | "red" = "blue";
	@type(Gun) public gun: Gun = new Gun;
}

export class MyRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();

	@type("number") public blueScore:number = 0;
	@type("number") public redScore:number = 0;
}
