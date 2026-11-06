import * as THREE from "three";
import { STALL, type BagKind } from "../constants";
import { assembleMidWing, makeMidWingGeo, paintMidWing } from "./wing";
import { prefersReducedMotion, tickJuice, cameraOffset } from "../juice";
import { skewerPing, oilPop, footstep } from "../audio";
import type { Sim } from "../sim";

function asMesh(o: THREE.Object3D): THREE.Mesh {
  return o as THREE.Mesh;
}
function asStd(mat: THREE.Material | THREE.Material[]): THREE.MeshStandardMaterial {
  return mat as THREE.MeshStandardMaterial;
}
function asBasic(mat: THREE.Material | THREE.Material[]): THREE.MeshBasicMaterial {
  return mat as THREE.MeshBasicMaterial;
}
function asPhys(mat: THREE.Material | THREE.Material[]): THREE.MeshPhysicalMaterial {
  return mat as THREE.MeshPhysicalMaterial;
}

export class StallScene {
	renderer!: THREE.WebGLRenderer;
	scene = new THREE.Scene();
	camera!: THREE.PerspectiveCamera;
	fork = new THREE.Group();
	wings: THREE.Group[] = [];
	fireLight!: THREE.PointLight;
	coals!: THREE.Points;
	plate!: THREE.Group;
	bowl!: THREE.Mesh;
	tongs!: THREE.Group;
	tongA!: THREE.Mesh;
	tongB!: THREE.Mesh;
	drips: THREE.Mesh[] = [];
	fillLight!: THREE.PointLight;
	occludeLight!: THREE.PointLight;
	wingKey!: THREE.PointLight;
	pools: THREE.Mesh[] = [];
	steam: THREE.Mesh[] = [];
	sweetRing!: THREE.Mesh;
	aimGhost!: THREE.Group;
	lantern!: THREE.Group;
	hanging!: THREE.Group;
	board!: THREE.Group;
	shopBags = {
		marinated: new THREE.Group(),
		plain: new THREE.Group()
	};
	ghostFork = new THREE.Group();
	npc!: THREE.Group;
	jets: THREE.Mesh[] = [];
	lanternLight!: THREE.PointLight;
	moths: THREE.Mesh[] = [];
	sparks: THREE.Mesh[] = [];
	shimmer: THREE.Mesh[] = [];
	grip = new THREE.Group();
	tines = new THREE.Group();
	t = 0;
	tongClose = 0;
	tongVel = 0;
	wingGeo!: THREE.BufferGeometry;
	camBase = new THREE.Vector3(.04, 1.08, 1.32);
	scoreFocus = 0;
	tongHandle!: THREE.Mesh;
	tongTipA!: THREE.Mesh;
	tongTipB!: THREE.Mesh;
	prevOnPlate = [false, false];
	plateBounce = 0;
	npcStepAcc = 0;
	lastNpcX = -2.4;
	prevThrust = 0;
	_handle = new THREE.Vector3();
	_tines = new THREE.Vector3();
	_dir = new THREE.Vector3();
	_xAxis = new THREE.Vector3(1, 0, 0);
	_look = new THREE.Vector3();
	_aimQ = new THREE.Quaternion();
	_basisX = new THREE.Vector3();
	_basisY = new THREE.Vector3();
	_basisZ = new THREE.Vector3();
	_basisM = new THREE.Matrix4();
	forkScale = .86;
	_ndc = new THREE.Vector3();
	tineScreen = [
		{ x: 50, y: 50, visible: false },
		{ x: 50, y: 50, visible: false },
	];
	constructor(canvas: HTMLCanvasElement) {
		this.renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: true,
			alpha: false,
			powerPreference: "high-performance"
		});
		this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
		this.renderer.setClearColor(2759720, 1);
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1.12;
		this.camera = new THREE.PerspectiveCamera(58, 1, .04, 50);
		this.camera.position.set(.04, 1.08, 1.32);
		this.camera.lookAt(0, .52, -.08);
		this.scene.fog = new THREE.Fog(2892336, 8.5, 24);
		const hemi = new THREE.HemisphereLight(16756848, 1713176, .58);
		this.scene.add(hemi);
		const amb = new THREE.AmbientLight(3813932, .32);
		this.scene.add(amb);
		const sun = new THREE.DirectionalLight(16747080, .42);
		sun.position.set(-7, 3.4, 3.5);
		this.scene.add(sun);
		this.fireLight = new THREE.PointLight(16738850, 5.2, 5.4, 1.55);
		this.fireLight.position.set(0, .5, -.14);
		this.scene.add(this.fireLight);
		this.fillLight = new THREE.PointLight(16760976, .9, 3.2, 1.8);
		this.fillLight.position.set(.25, .7, .2);
		this.scene.add(this.fillLight);
		this.occludeLight = new THREE.PointLight(1181701, .35, .72, 2.8);
		this.occludeLight.position.set(.4, .7, .15);
		this.scene.add(this.occludeLight);
		this.wingKey = new THREE.PointLight(16756848, .7, 1.8, 2);
		this.wingKey.position.set(-.2, .85, .3);
		this.scene.add(this.wingKey);
		this.wingGeo = makeMidWingGeo();
		this.buildStall();
		this.scene.add(this.fork);
		this.buildFork();
		this.grip = this.makeGrip();
		this.scene.add(this.grip);
		this.plate = this.makePlate();
		this.plate.position.set(.72, .44, .28);
		this.scene.add(this.plate);
		this.bowl = this.makeBowl();
		this.bowl.position.set(-.72, .42, .22);
		this.scene.add(this.bowl);
		this.tongs = this.makeTongs();
		this.tongs.visible = false;
		this.scene.add(this.tongs);
		this.coals = this.makeEmbers();
		this.scene.add(this.coals);
		this.sweetRing = this.makeSweetRing();
		this.scene.add(this.sweetRing);
		this.aimGhost = this.makeAimGhost();
		this.aimGhost.scale.setScalar(this.forkScale);
		this.scene.add(this.aimGhost);
		this.ghostFork = this.makeAimGhost();
		this.ghostFork.scale.setScalar(this.forkScale);
		this.ghostFork.visible = false;
		this.scene.add(this.ghostFork);
		this.resize();
		window.addEventListener("resize", () => this.resize());
	}
	makeSweetRing() {
		const geo = new THREE.RingGeometry(.22, .28, 40);
		const mat = new THREE.MeshBasicMaterial({
			color: 16756832,
			transparent: true,
			opacity: .35,
			side: THREE.DoubleSide,
			depthWrite: false
		});
		const m = new THREE.Mesh(geo, mat);
		m.rotation.x = -Math.PI / 2;
		m.position.set(0, .64, -.14);
		m.visible = false;
		return m;
	}
	makeAimGhost() {
		const g = new THREE.Group();
		const mat = new THREE.MeshBasicMaterial({
			color: 11064575,
			transparent: true,
			opacity: .28,
			depthWrite: false
		});
		const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.007, .01, 1.12, 8), mat);
		shaft.rotation.z = Math.PI / 2;
		shaft.position.x = -.08;
		g.add(shaft);
		for (const side of [-1, 1]) {
			const tine = new THREE.Mesh(new THREE.BoxGeometry(.4, .007, .012), mat);
			tine.position.set(.68, side * .022, 0);
			g.add(tine);
		}
		g.visible = false;
		return g;
	}
	resize() {
		const c = this.renderer.domElement;
		const w = c.clientWidth || window.innerWidth;
		const h = c.clientHeight || window.innerHeight;
		this.renderer.setSize(w, h, false);
		this.camera.aspect = w / h;
		this.camera.fov = w / h > 1 ? 52 : 66;
		this.camera.updateProjectionMatrix();
	}
	buildStall() {
		const sky = new THREE.Mesh(new THREE.SphereGeometry(22, 24, 16), new THREE.MeshBasicMaterial({
			map: this.makeSkyTex(),
			side: THREE.BackSide,
			fog: false
		}));
		this.scene.add(sky);
		const hillMat = new THREE.MeshStandardMaterial({
			color: 2371612,
			roughness: 1
		});
		const hill = new THREE.Mesh(new THREE.SphereGeometry(4.2, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), hillMat);
		hill.position.set(-3.4, -2, -9.2);
		hill.scale.set(2.4, .85, 1.15);
		this.scene.add(hill);
		const hill2 = hill.clone();
		hill2.position.set(4.6, -2.2, -10);
		hill2.scale.set(2.8, .7, 1.3);
		this.scene.add(hill2);
		const hill3 = hill.clone();
		hill3.position.set(.4, -2.6, -12);
		hill3.scale.set(3.4, .55, 1.2);
		this.scene.add(hill3);
		const grass = new THREE.Mesh(new THREE.PlaneGeometry(28, 22), new THREE.MeshStandardMaterial({
			color: 2371612,
			roughness: 1
		}));
		grass.rotation.x = -Math.PI / 2;
		this.scene.add(grass);
		const dirt = new THREE.Mesh(new THREE.CircleGeometry(3.4, 24), new THREE.MeshStandardMaterial({
			color: 3813924,
			roughness: 1
		}));
		dirt.rotation.x = -Math.PI / 2;
		dirt.position.y = .008;
		this.scene.add(dirt);
		const slab = new THREE.Mesh(new THREE.BoxGeometry(5.2, .07, 3.6), new THREE.MeshStandardMaterial({
			color: 8026222,
			roughness: .94
		}));
		slab.position.set(0, .035, .2);
		this.scene.add(slab);
		const tableMat = new THREE.MeshStandardMaterial({
			color: 9341570,
			roughness: .9
		});
		const table = new THREE.Mesh(new THREE.BoxGeometry(2.7, .09, 1.28), tableMat);
		table.position.set(0, .36, .22);
		this.scene.add(table);
		const steelLeg = new THREE.MeshStandardMaterial({
			color: 4868164,
			roughness: .55,
			metalness: .45
		});
		for (const x of [-1.15, 1.15]) {
			const leg = new THREE.Mesh(new THREE.BoxGeometry(.07, .34, 1.18), steelLeg);
			leg.position.set(x, .17, .22);
			this.scene.add(leg);
		}
		const benchMat = new THREE.MeshStandardMaterial({
			color: 6967360,
			roughness: .82
		});
		for (const z of [.95, -.52]) {
			const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, .06, .28), benchMat);
			bench.position.set(0, .28, z);
			this.scene.add(bench);
			for (const bx of [-.9, .9]) {
				const bleg = new THREE.Mesh(new THREE.BoxGeometry(.06, .22, .22), steelLeg);
				bleg.position.set(bx, .14, z);
				this.scene.add(bleg);
			}
		}
		const zinc = new THREE.MeshStandardMaterial({
			color: 9080466,
			roughness: .42,
			metalness: .72
		});
		const rust = new THREE.MeshStandardMaterial({
			color: 5914676,
			roughness: .7,
			metalness: .35
		});
		const pitOuter = new THREE.Mesh(new THREE.BoxGeometry(1.22, .26, .62), zinc);
		pitOuter.position.set(0, .48, -.14);
		this.scene.add(pitOuter);
		const pitLip = new THREE.Mesh(new THREE.BoxGeometry(1.28, .03, .68), rust);
		pitLip.position.set(0, .6, -.14);
		this.scene.add(pitLip);
		const pitIn = new THREE.Mesh(new THREE.BoxGeometry(1.04, .18, .46), new THREE.MeshStandardMaterial({
			color: 1314314,
			roughness: .95
		}));
		pitIn.position.set(0, .5, -.14);
		this.scene.add(pitIn);
		const glow = new THREE.Mesh(new THREE.PlaneGeometry(.98, .4), new THREE.MeshBasicMaterial({ color: 16730642 }));
		glow.rotation.x = -Math.PI / 2;
		glow.position.set(0, .42, -.14);
		this.scene.add(glow);
		for (const hx of [-.64, .64]) {
			const handle = new THREE.Mesh(new THREE.TorusGeometry(.045, .01, 6, 10, Math.PI), zinc);
			handle.rotation.z = hx > 0 ? -Math.PI / 2 : Math.PI / 2;
			handle.position.set(hx, .5, -.14);
			this.scene.add(handle);
		}
		const grateMat = new THREE.MeshStandardMaterial({
			color: 4868680,
			metalness: .78,
			roughness: .35
		});
		const grate = new THREE.Group();
		for (let i = 0; i < 11; i++) {
			const bar = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .54, 5), grateMat);
			bar.rotation.x = Math.PI / 2;
			bar.position.set(-.5 + i * .1, .61, -.14);
			grate.add(bar);
		}
		for (let j = 0; j < 6; j++) {
			const bar = new THREE.Mesh(new THREE.CylinderGeometry(.005, .005, 1.02, 5), grateMat);
			bar.rotation.z = Math.PI / 2;
			bar.position.set(0, .615, -.34 + j * .08);
			grate.add(bar);
		}
		this.scene.add(grate);
		const postMat = new THREE.MeshStandardMaterial({
			color: 9054754,
			roughness: .72
		});
		for (const xz of [
			[-2.35, -1.55],
			[2.35, -1.55],
			[-2.35, -3.15],
			[2.35, -3.15]
		]) {
			const post = new THREE.Mesh(new THREE.CylinderGeometry(.07, .08, 2.35, 8), postMat);
			post.position.set(xz[0], 1.2, xz[1]);
			this.scene.add(post);
		}
		const roof = new THREE.Mesh(new THREE.BoxGeometry(5.1, .06, 2.05), new THREE.MeshStandardMaterial({
			color: 3828282,
			roughness: .7
		}));
		roof.position.set(0, 2.38, -2.35);
		roof.rotation.x = -.12;
		this.scene.add(roof);
		for (let i = 0; i < 7; i++) {
			const tile = new THREE.Mesh(new THREE.BoxGeometry(5.15, .025, .14), new THREE.MeshStandardMaterial({
				color: i % 2 ? 2774058 : 4880954,
				roughness: .65
			}));
			tile.position.set(0, 2.42, -3.2 + i * .26);
			tile.rotation.x = -.12;
			this.scene.add(tile);
		}
		this.lantern = new THREE.Group();
		const pole = new THREE.Mesh(new THREE.CylinderGeometry(.022, .028, 1.7, 8), new THREE.MeshStandardMaterial({
			color: 4869200,
			metalness: .55,
			roughness: .4
		}));
		pole.position.set(0, -.55, 0);
		this.lantern.add(pole);
		const tube = new THREE.Mesh(new THREE.CylinderGeometry(.028, .028, .72, 10), new THREE.MeshBasicMaterial({ color: 16052436 }));
		tube.rotation.z = Math.PI / 2;
		this.lantern.add(tube);
		this.lantern.position.set(1.55, 1.72, .55);
		this.scene.add(this.lantern);
		this.lanternLight = new THREE.PointLight(15262920, .7, 5.2, 1.7);
		this.lanternLight.position.set(1.55, 1.72, .55);
		this.scene.add(this.lanternLight);
		this.spawnMoths();
		this.spawnShimmer();
		this.hanging = new THREE.Group();
		const bag = new THREE.Mesh(new THREE.BoxGeometry(.3, .42, .2), new THREE.MeshStandardMaterial({
			map: this.makeCharcoalBagTex(),
			roughness: .88
		}));
		const bagTop = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, .07, 8), new THREE.MeshStandardMaterial({
			color: 2763302,
			roughness: .8
		}));
		bagTop.position.y = .24;
		this.hanging.add(bag, bagTop);
		this.hanging.position.set(1.42, .28, .72);
		this.scene.add(this.hanging);
		const soy = new THREE.Mesh(new THREE.CylinderGeometry(.07, .075, .035, 16), new THREE.MeshStandardMaterial({
			color: 15919832,
			roughness: .45
		}));
		soy.position.set(-1.15, .42, .55);
		this.scene.add(soy);
		const soyLiq = new THREE.Mesh(new THREE.CircleGeometry(.055, 12), new THREE.MeshStandardMaterial({
			color: 2757644,
			roughness: .2,
			emissive: 1181700,
			emissiveIntensity: .15
		}));
		soyLiq.rotation.x = -Math.PI / 2;
		soyLiq.position.set(-1.15, .44, .55);
		this.scene.add(soyLiq);
		const chili = new THREE.Mesh(new THREE.CylinderGeometry(.055, .06, .03, 14), new THREE.MeshStandardMaterial({
			color: 15260872,
			roughness: .5
		}));
		chili.position.set(-1.32, .415, .42);
		this.scene.add(chili);
		const chiliLiq = new THREE.Mesh(new THREE.CircleGeometry(.042, 12), new THREE.MeshStandardMaterial({
			color: 9050636,
			roughness: .25,
			emissive: 3803136,
			emissiveIntensity: .2
		}));
		chiliLiq.rotation.x = -Math.PI / 2;
		chiliLiq.position.set(-1.32, .432, .42);
		this.scene.add(chiliLiq);
		const foil = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .32, 12), new THREE.MeshStandardMaterial({
			color: 13159632,
			metalness: .85,
			roughness: .22
		}));
		foil.rotation.z = Math.PI / 2;
		foil.position.set(1.18, .43, .18);
		this.scene.add(foil);
		this.board = new THREE.Group();
		const boardMesh = new THREE.Mesh(new THREE.BoxGeometry(1.28, .04, .64), new THREE.MeshStandardMaterial({
			color: 5913122,
			roughness: .8
		}));
		this.board.add(boardMesh);
		this.board.position.set(0, .42, .72);
		this.scene.add(this.board);
		this.shopBags.marinated = this.makeShopBag("marinated");
		this.shopBags.marinated.position.set(-.3, .2, -.06);
		this.board.add(this.shopBags.marinated);
		this.shopBags.plain = this.makeShopBag("plain");
		this.shopBags.plain.position.set(.3, .2, -.06);
		this.board.add(this.shopBags.plain);
		const sign = new THREE.Mesh(new THREE.BoxGeometry(.85, .38, .04), new THREE.MeshStandardMaterial({
			map: this.makeSignTex(),
			roughness: .7
		}));
		sign.position.set(-2.05, 1.35, -1.35);
		sign.rotation.y = .45;
		this.scene.add(sign);
		const signPost = new THREE.Mesh(new THREE.CylinderGeometry(.03, .035, 1.2, 6), new THREE.MeshStandardMaterial({
			color: 4864552,
			roughness: .85
		}));
		signPost.position.set(-2.05, .6, -1.35);
		this.scene.add(signPost);
		const fenceMat = new THREE.MeshStandardMaterial({
			color: 6975090,
			metalness: .55,
			roughness: .45
		});
		for (let i = 0; i < 9; i++) {
			const fp = new THREE.Mesh(new THREE.CylinderGeometry(.018, .02, 1.05, 5), fenceMat);
			fp.position.set(-4.2 + i * 1.05, .52, -4.6);
			this.scene.add(fp);
		}
		for (const y of [
			.22,
			.55,
			.88
		]) {
			const rail = new THREE.Mesh(new THREE.BoxGeometry(8.6, .018, .018), fenceMat);
			rail.position.set(0, y, -4.6);
			this.scene.add(rail);
		}
		const treeMat = new THREE.MeshStandardMaterial({
			color: 1845782,
			roughness: 1
		});
		const trunkMat = new THREE.MeshStandardMaterial({
			color: 3811868,
			roughness: .9
		});
		for (const [x, z, s] of [
			[
				-4.8,
				-6.2,
				1.15
			],
			[
				5.1,
				-6.8,
				1.35
			],
			[
				-6.2,
				-4.4,
				.9
			],
			[
				6.4,
				-5.2,
				1.05
			],
			[
				3.2,
				-8.4,
				1.5
			]
		]) {
			const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.07 * s, .1 * s, .9 * s, 6), trunkMat);
			trunk.position.set(x, .45 * s, z);
			this.scene.add(trunk);
			const crown = new THREE.Mesh(new THREE.ConeGeometry(.55 * s, 1.4 * s, 7), treeMat);
			crown.position.set(x, 1.35 * s, z);
			this.scene.add(crown);
		}
		const tapPost = new THREE.Mesh(new THREE.CylinderGeometry(.03, .04, .7, 8), new THREE.MeshStandardMaterial({
			color: 6975090,
			metalness: .5,
			roughness: .4
		}));
		tapPost.position.set(-1.85, .38, .95);
		this.scene.add(tapPost);
		const tap = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .14, 6), new THREE.MeshStandardMaterial({
			color: 11580600,
			metalness: .8,
			roughness: .25
		}));
		tap.rotation.z = Math.PI / 2;
		tap.position.set(-1.76, .68, .95);
		this.scene.add(tap);
		this.npc = new THREE.Group();
		const body = new THREE.Mesh(new THREE.CapsuleGeometry(.09, .28, 4, 8), new THREE.MeshBasicMaterial({
			color: 657157,
			transparent: true,
			opacity: .45
		}));
		body.position.y = .28;
		this.npc.add(body);
		this.npc.position.set(-2.8, .12, -2.4);
		this.scene.add(this.npc);
	}
	buildFork() {
		const metal = new THREE.MeshStandardMaterial({
			color: 11581116,
			metalness: .92,
			roughness: .18
		});
		const wood = new THREE.MeshStandardMaterial({
			color: 7224600,
			roughness: .84,
			metalness: .02
		});
		const handle = new THREE.Mesh(new THREE.CylinderGeometry(.03, .038, .5, 14), wood);
		handle.rotation.z = Math.PI / 2;
		handle.position.x = -1.02;
		this.fork.add(handle);
		const butt = new THREE.Mesh(new THREE.SphereGeometry(.034, 10, 8), wood);
		butt.scale.set(.7, 1, 1);
		butt.position.x = -1.27;
		this.fork.add(butt);
		const ring = new THREE.Mesh(new THREE.TorusGeometry(.018, .004, 6, 10), metal);
		ring.rotation.y = Math.PI / 2;
		ring.position.x = -1.29;
		this.fork.add(ring);
		const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(.02, .024, .07, 12), metal);
		ferrule.rotation.z = Math.PI / 2;
		ferrule.position.x = -.76;
		this.fork.add(ferrule);
		const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.0075, .011, 1.18, 12), metal);
		shaft.rotation.z = Math.PI / 2;
		shaft.position.x = -.14;
		this.fork.add(shaft);
		const split = new THREE.Mesh(new THREE.SphereGeometry(.014, 8, 6), metal);
		split.scale.set(1.4, .7, 1.1);
		split.position.set(.46, 0, 0);
		this.fork.add(split);
		this.tines = new THREE.Group();
		this.tines.name = "tines";
		for (const side of [-1, 1]) {
			const tine = new THREE.Mesh(new THREE.BoxGeometry(.4, .006, .013), metal);
			tine.position.set(.66, side * .022, 0);
			this.tines.add(tine);
			const tip = new THREE.Mesh(new THREE.ConeGeometry(.006, .055, 6), metal);
			tip.rotation.z = -Math.PI / 2;
			tip.position.set(.88, side * .022, 0);
			this.tines.add(tip);
			const tipPoint = new THREE.Object3D();
			tipPoint.name = side > 0 ? "tipA" : "tipB";
			tipPoint.position.set(.908, side * .022, 0);
			this.tines.add(tipPoint);
		}
		this.fork.add(this.tines);
		this.fork.position.set(-.15, .78, .38);
		this.fork.scale.setScalar(this.forkScale);
	}
	/** Sit-at-grill pose: handle in front of the seated camera, tines over the pit. A = left (−X). */
	poseHeldFork(group: THREE.Object3D, angle: number, distance: number, extraY = 0) {
		const dist = Math.max(.08, Math.min(1.2, distance));
		const native = 1.74;
		this._tines.set(-angle * .72, .54 + dist * .4 + extraY, -.05 - (1 - dist) * .08);
		this._handle.set(-angle * .07 + .1, .76, .96);
		this._dir.copy(this._tines).sub(this._handle);
		const len = this._dir.length();
		if (len < 1e-4) this._dir.set(0, -.12, -1);
		else this._dir.multiplyScalar(1 / len);
		const scale = Math.max(.45, Math.min(.82, len / native));
		group.scale.setScalar(scale);
		this._aimQ.setFromUnitVectors(this._xAxis, this._dir);
		if (Number.isNaN(this._aimQ.x)) this._aimQ.identity();
		group.quaternion.copy(this._aimQ);
		group.position.copy(this._tines).addScaledVector(this._dir, -.72 * scale);
		if (Number.isNaN(group.position.x)) group.position.set(0, .8, .4);
	}
	/** Close-up 吉 pose: two tines in frame, driving into the wing as thrust rises. */
	poseSkewerFork(thrust: number) {
		const t = Math.max(0, Math.min(1, thrust));
		this._tines.set(.04, .72 - t * .06, .24 - t * .16);
		const scale = .8;
		this._handle.set(.18, .34, 1.05);
		this._dir.copy(this._tines).sub(this._handle);
		if (this._dir.lengthSq() < 1e-6) this._dir.set(0, 0, -1);
		else this._dir.normalize();
		this._basisX.copy(this._dir);
		const dot = this._basisX.y;
		this._basisY.set(-this._basisX.x * dot, 1 - dot * dot, -this._basisX.z * dot);
		if (this._basisY.lengthSq() < 1e-6) this._basisY.set(0, 0, 1);
		this._basisY.normalize();
		this._basisZ.crossVectors(this._basisX, this._basisY).normalize();
		this._basisM.makeBasis(this._basisX, this._basisY, this._basisZ);
		this._aimQ.setFromRotationMatrix(this._basisM);
		this.fork.quaternion.copy(this._aimQ);
		this.fork.scale.setScalar(scale);
		this.fork.position.copy(this._tines).addScaledVector(this._dir, -.908 * scale);
	}
	makeGrip() {
		const skin = new THREE.MeshStandardMaterial({
			color: 12884594,
			roughness: .72,
			metalness: .02
		});
		const g = new THREE.Group();
		for (const side of [-1, 1]) {
			const fist = new THREE.Mesh(new THREE.SphereGeometry(.03, 10, 8), skin);
			fist.scale.set(1.35, .68, .82);
			fist.position.set(side * .05, -.01, 0);
			g.add(fist);
			const thumb = new THREE.Mesh(new THREE.SphereGeometry(.011, 8, 6), skin);
			thumb.position.set(side * .028, .016, .018);
			g.add(thumb);
		}
		return g;
	}
	makeWingGeo() {
		return makeMidWingGeo();
	}
	paintWing(mesh: THREE.Mesh, heat: number, char: number, honey: number, faceA: number, faceB: number, innerShade = 0, innerSign = 0) {
		paintMidWing(mesh, heat, char, honey, faceA, faceB, innerShade, innerSign);
	}
	setWingCount(n: number) {
		while (this.wings.length < n) {
			const grp = assembleMidWing({ uniqueGeo: true });
			this.fork.add(grp);
			this.wings.push(grp);
		}
		this.wings.forEach((w, i) => {
			w.visible = i < n;
			w.position.set(.6 + i * .17, i === 1 ? .035 : -.01, 0);
		});
	}
	makeSkyTex() {
		const s = 256;
		const c = document.createElement("canvas");
		c.width = s;
		c.height = s;
		const ctx = c.getContext("2d")!;
		const g = ctx.createLinearGradient(0, 0, 0, s);
		g.addColorStop(0, "#12182e");
		g.addColorStop(.38, "#3d2a48");
		g.addColorStop(.52, "#c45a32");
		g.addColorStop(.62, "#e89050");
		g.addColorStop(1, "#1c1812");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, s, s);
		const tex = new THREE.CanvasTexture(c);
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.needsUpdate = true;
		return tex;
	}
	makeSignTex() {
		const s = 256;
		const c = document.createElement("canvas");
		c.width = s;
		c.height = 128;
		const ctx = c.getContext("2d")!;
		ctx.fillStyle = "#2f5a32";
		ctx.fillRect(0, 0, s, 128);
		ctx.strokeStyle = "#d8c48a";
		ctx.lineWidth = 8;
		ctx.strokeRect(6, 6, 244, 116);
		ctx.fillStyle = "#f4ead4";
		ctx.font = "bold 42px serif";
		ctx.textAlign = "center";
		ctx.fillText("燒烤場", s / 2, 58);
		ctx.font = "bold 22px sans-serif";
		ctx.fillText("BBQ SITE", s / 2, 96);
		const tex = new THREE.CanvasTexture(c);
		tex.colorSpace = THREE.SRGBColorSpace;
		return tex;
	}
	makeCharcoalBagTex() {
		const s = 128;
		const c = document.createElement("canvas");
		c.width = s;
		c.height = s;
		const ctx = c.getContext("2d")!;
		ctx.fillStyle = "#1a1a16";
		ctx.fillRect(0, 0, s, s);
		ctx.fillStyle = "#d4a21a";
		ctx.fillRect(0, 18, s, 28);
		ctx.fillStyle = "#1a1a16";
		ctx.font = "bold 16px sans-serif";
		ctx.textAlign = "center";
		ctx.fillText("木炭", s / 2, 38);
		ctx.fillStyle = "#d4a21a";
		ctx.font = "12px sans-serif";
		ctx.fillText("CHARCOAL", s / 2, 72);
		const tex = new THREE.CanvasTexture(c);
		tex.colorSpace = THREE.SRGBColorSpace;
		return tex;
	}
	makeShopBagTex(kind: BagKind) {
		const s = 256;
		const c = document.createElement("canvas");
		c.width = s;
		c.height = s;
		const ctx = c.getContext("2d")!;
		if (kind === "marinated") {
			const g = ctx.createLinearGradient(0, 0, s, s);
			g.addColorStop(0, "#5a3218");
			g.addColorStop(.5, "#3a1e0e");
			g.addColorStop(1, "#2a1408");
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, s, s);
			ctx.fillStyle = "#c47a12";
			ctx.fillRect(0, 28, s, 52);
			ctx.fillStyle = "#e8c070";
			ctx.fillRect(0, 96, s, 8);
		} else {
			ctx.fillStyle = "#e8e4dc";
			ctx.fillRect(0, 0, s, s);
			ctx.fillStyle = "#b01a1a";
			ctx.fillRect(0, 28, s, 18);
			ctx.fillStyle = "#f4ead4";
			ctx.fillRect(0, 96, s, 8);
		}
		const tex = new THREE.CanvasTexture(c);
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.anisotropy = 4;
		return tex;
	}
	makeShopBag(kind: BagKind) {
		const g = new THREE.Group();
		g.name = kind === "marinated" ? "bag-marinated" : "bag-plain";
		g.userData.pickKind = "bag";
		g.userData.bag = kind;
		const bodyMat = new THREE.MeshStandardMaterial({
			map: this.makeShopBagTex(kind),
			color: kind === "marinated" ? 8014370 : 16052456,
			roughness: .38,
			metalness: .02,
			transparent: true,
			opacity: kind === "marinated" ? .82 : .62,
			side: THREE.DoubleSide
		});
		const body = new THREE.Mesh(new THREE.BoxGeometry(.48, .36, .22), bodyMat);
		body.userData.pickKind = "bag";
		body.userData.bag = kind;
		g.add(body);
		const lip = new THREE.Mesh(new THREE.BoxGeometry(.5, .04, .04), new THREE.MeshStandardMaterial({
			color: kind === "marinated" ? 3810320 : 14209220,
			roughness: .55
		}));
		lip.position.y = .18;
		lip.userData.pickKind = "bag";
		lip.userData.bag = kind;
		g.add(lip);
		const handleMat = new THREE.MeshStandardMaterial({
			color: kind === "marinated" ? 3810320 : 14209220,
			roughness: .55
		});
		for (const x of [-.1, .1]) {
			const handle = new THREE.Mesh(new THREE.TorusGeometry(.06, .008, 6, 12, Math.PI), handleMat);
			handle.rotation.z = Math.PI;
			handle.position.set(x, .21, 0);
			handle.userData.pickKind = "bag";
			handle.userData.bag = kind;
			g.add(handle);
		}
		const guts = new THREE.Group();
		guts.name = "guts";
		const peek = assembleMidWing();
		peek.scale.setScalar(1.15);
		peek.position.set(0, .22, .02);
		peek.rotation.set(-.95, kind === "marinated" ? .65 : -.5, .1);
		if (kind === "marinated") {
			peek.traverse((o) => {
				if (!(o instanceof THREE.Mesh) || o.name !== "meat") return;
				asStd(o.material).color.setHex(0xd08a3c);
			});
		}
		guts.add(peek);
		g.add(guts);
		return g;
	}
	lookMarinated(grp: THREE.Object3D) {
		grp.traverse((o) => {
			if (!(o instanceof THREE.Mesh)) return;
			const mat = o.material as THREE.MeshStandardMaterial;
			if (!mat?.color) return;
			if (o.name === "glaze") {
				o.visible = true;
				const gm = mat as THREE.MeshPhysicalMaterial;
				gm.color.setHex(5909008);
				gm.opacity = .52;
				gm.emissive.setHex(2756616);
				gm.emissiveIntensity = .18;
				return;
			}
			if (o.name === "meat" || o.name === "fat" || o.name === "skin") {
				mat.color.multiplyScalar(.72);
				mat.color.offsetHSL(-.04, .12, -.08);
			}
		});
		const glaze = grp.getObjectByName("glaze");
		if (glaze) glaze.visible = true;
	}
	makePlate() {
		const g = new THREE.Group();
		const base = new THREE.Mesh(new THREE.CylinderGeometry(.28, .3, .03, 24), new THREE.MeshStandardMaterial({
			color: 15260872,
			roughness: .7
		}));
		g.add(base);
		const paper = new THREE.Mesh(new THREE.CircleGeometry(.26, 24), new THREE.MeshStandardMaterial({
			map: this.makeNewsTex(),
			color: 15919828,
			roughness: .92
		}));
		paper.rotation.x = -Math.PI / 2;
		paper.position.y = .017;
		g.add(paper);
		return g;
	}
	makeNewsTex() {
		const s = 512;
		const c = document.createElement("canvas");
		c.width = s;
		c.height = s;
		const ctx = c.getContext("2d")!;
		ctx.fillStyle = "#f4ead4";
		ctx.fillRect(0, 0, s, s);
		ctx.fillStyle = "#d8c8a8";
		ctx.font = "18px serif";
		for (let y = 18; y < 504; y += 18) {
			ctx.globalAlpha = .45 + y % 3 * .1;
			ctx.fillRect(16, y, 160 + y % 80, 5);
			ctx.fillRect(200, y + 2, 140 + y * 3 % 90, 4);
			ctx.fillRect(360, y, 120 + y % 50, 4);
		}
		ctx.globalAlpha = .7;
		ctx.fillStyle = "#6a2414";
		ctx.font = "bold 36px serif";
		ctx.fillText("燒雞翼 晚報", 28, 52);
		ctx.globalAlpha = 1;
		const tex = new THREE.CanvasTexture(c);
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.anisotropy = 4;
		return tex;
	}
	makeBowl() {
		const m = new THREE.Mesh(new THREE.SphereGeometry(.16, 16, 12, 0, Math.PI * 2, 0, Math.PI * .55), new THREE.MeshStandardMaterial({
			color: 6957586,
			roughness: .35,
			metalness: .2
		}));
		const liquid = new THREE.Mesh(new THREE.CircleGeometry(.12, 16), new THREE.MeshStandardMaterial({
			color: 12876306,
			roughness: .25,
			emissive: 3807744,
			emissiveIntensity: .2
		}));
		liquid.name = "liquid";
		liquid.rotation.x = -Math.PI / 2;
		liquid.position.y = .02;
		m.add(liquid);
		return m;
	}
	makeTongs() {
		const g = new THREE.Group();
		const steel = new THREE.MeshStandardMaterial({
			color: 6975094,
			metalness: .82,
			roughness: .28
		});
		const grip = new THREE.MeshStandardMaterial({
			color: 2763824,
			metalness: .15,
			roughness: .72
		});
		const hub = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .022, 10), steel);
		hub.rotation.x = Math.PI / 2;
		g.add(hub);
		this.tongHandle = new THREE.Mesh(new THREE.BoxGeometry(.16, .022, .03), grip);
		this.tongHandle.position.set(-.14, 0, 0);
		g.add(this.tongHandle);
		this.tongA = new THREE.Mesh(new THREE.BoxGeometry(.36, .014, .022), steel);
		this.tongA.position.set(.16, .028, 0);
		g.add(this.tongA);
		this.tongB = new THREE.Mesh(new THREE.BoxGeometry(.36, .014, .022), steel);
		this.tongB.position.set(.16, -.028, 0);
		g.add(this.tongB);
		const tipMat = new THREE.MeshStandardMaterial({
			color: 3816772,
			metalness: .55,
			roughness: .4
		});
		this.tongTipA = new THREE.Mesh(new THREE.BoxGeometry(.07, .02, .032), tipMat);
		this.tongTipA.position.set(.32, .028, 0);
		g.add(this.tongTipA);
		this.tongTipB = new THREE.Mesh(new THREE.BoxGeometry(.07, .02, .032), tipMat);
		this.tongTipB.position.set(.32, -.028, 0);
		g.add(this.tongTipB);
		return g;
	}
	makeEmbers() {
		const count = 80;
		const pos = /* @__PURE__ */ new Float32Array(240);
		for (let i = 0; i < count; i++) {
			pos[i * 3] = (Math.random() - .5) * .55;
			pos[i * 3 + 1] = .44 + Math.random() * .22;
			pos[i * 3 + 2] = -.14 + (Math.random() - .5) * .38;
		}
		const geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
		const mat = new THREE.PointsMaterial({
			color: 16738848,
			size: .025,
			transparent: true,
			opacity: .85
		});
		return new THREE.Points(geo, mat);
	}
	sync(sim: Sim, dt: number) {
		this.t += dt;
		const quiet = prefersReducedMotion();
		this.lantern.rotation.z = 0;
		this.hanging.visible = sim.phase !== "title" && sim.phase !== "skewer";
		this.hanging.rotation.z = quiet ? 0 : Math.sin(this.t * .35) * .015;
		if (this.lanternLight) {
			const flick = quiet ? 0 : Math.sin(this.t * 7.4) * STALL.lanternFlicker + Math.sin(this.t * 19) * .08;
			this.lanternLight.intensity = 1.05 + flick;
		}
		this.tickMoths(quiet);
		this.tickShimmer(quiet, sim);
		const fireBoost = sim.phase === "roast1" || sim.phase === "roast2" ? 1 : .45;
		const flicker = quiet ? 0 : Math.sin(this.t * 11) * .55 + Math.sin(this.t * 23) * .2;
		this.fireLight.intensity = (3.6 + flicker) * fireBoost;
		const dist = sim.distance;
		this.tines.rotation.x = sim.forkRoll;
		const parallel0 = (sim.wings[0]?.skewerStyle ?? sim.skewerStyle) === "parallel" && sim.wingCount === 1;
		const lock0 = sim.wings[0]?.skewerQuality ?? .4;
		const aiming = sim.phase === "skewer" && !sim.wings.every((w) => w.onFork);
		const pinch = aiming ? .105 : parallel0 ? .022 : .022 - Math.max(0, lock0 - .35) * .012;
		this.tines.children.forEach((ch) => {
			if (Math.abs(ch.position.y) > .008) ch.position.y = Math.sign(ch.position.y) * pinch;
		});
		if (sim.phase === "pick" || sim.phase === "count") this.poseHeldFork(this.fork, -.52, .88);
		else if (sim.phase === "skewer") this.poseSkewerFork(sim.thrust);
		else if (sim.phase !== "score") this.poseHeldFork(this.fork, sim.angle, dist);
		this.grip.visible = sim.phase !== "score" && sim.phase !== "extract" && sim.phase !== "title";
		this.fork.visible = sim.phase !== "title";
		if (this.grip.visible) {
			this.fork.localToWorld(this._handle.set(-1.02, -.02, 0));
			this.grip.position.copy(this._handle);
			this.grip.quaternion.copy(this.fork.quaternion);
		}
		this.setWingCount(Math.max(1, sim.wings.length || (sim.phase === "title" || sim.phase === "skewer" ? 1 : sim.wingCount)));
		if (sim.phase === "pick" || sim.phase === "count") this.wings.forEach((grp) => {
			grp.visible = false;
		});
		const twoRoastNow = sim.wingCount === 2 && (sim.phase === "roast1" || sim.phase === "roast2" || sim.phase === "honey");
		const stackFactor = twoRoastNow ? 1 - Math.min(1, Math.abs(sim.angle) * 1.4) : 0;
		const innerShade = twoRoastNow ? .35 + stackFactor * .45 : 0;
		sim.wings.forEach((w, i) => {
			const grp = this.wings[i];
			if (!grp) return;
			grp.visible = sim.phase !== "pick" && sim.phase !== "count";
			const mesh = asMesh(grp.getObjectByName("meat") ?? grp.children[0]);
			const innerSign = twoRoastNow ? i === 0 ? 1 : -1 : 0;
			this.paintWing(mesh, w.heat, w.char, w.honey, w.faceA, w.faceB, innerShade, innerSign);
			const mat = asStd(mesh.material);
			const isSoy = sim.glaze === "soy";
			mat.roughness = .55 - w.honey * (isSoy ? .28 : .42);
			mat.metalness = .03 + w.honey * (isSoy ? .12 : .22);
			mat.emissive.setHex(isSoy ? 2756616 : 4859924);
			mat.emissiveIntensity = .05 + w.honey * (isSoy ? .08 : .14) + w.char * .1;
			const glaze = grp.getObjectByName("glaze");
			if (glaze) {
				const gm = asPhys(asMesh(glaze).material);
				const h = Math.min(1, w.honey);
				glaze.visible = h > .08;
				gm.color.setHex(isSoy ? 4858384 : 12876306);
				gm.emissive.setHex(isSoy ? 1705988 : 3807232);
				gm.opacity = Math.min(.72, h * (isSoy ? .7 : .85));
				gm.emissiveIntensity = h * (isSoy ? .18 : .28);
				gm.roughness = isSoy ? .22 - h * .08 : .12 - h * .06;
				gm.clearcoat = isSoy ? .45 + h * .25 : .7 + h * .3;
				gm.transmission = isSoy ? .12 + h * .18 : .35 + h * .35;
				const pulse = sim.phase === "honey" && !quiet ? 1 + Math.sin(this.t * 5 + i) * .03 * h : 1;
				glaze.scale.setScalar(pulse);
			}
			if (sim.phase === "extract") {
				const f = sim.extractForce;
				const stretchY = 1 + f * .38;
				const squash = 1 - f * .12;
				grp.scale.set(w.size * 1.32 * squash, w.size * 1.32 * stretchY, w.size * 1.32 * squash);
				grp.rotation.z = -f * .18;
				grp.rotation.x = w.hang * (1 - f);
			} else if (sim.phase === "skewer" && !w.onFork) {
				if (grp.parent === this.fork) this.scene.attach(grp);
				grp.visible = true;
				const a = sim.wingAim;
				grp.position.set(0.04 + a.x, 0.66 + a.y, 0.08 + a.z);
				grp.rotation.set(a.pitch, a.yaw, a.roll);
				grp.scale.setScalar(w.size * 2.05);
				this.updateSkewerAim(sim, grp);
			} else if (sim.phase === "title") {
				if (grp.parent === this.fork) this.scene.attach(grp);
				grp.visible = i === 0;
				grp.position.set(0.0, 0.56, 0.2);
				grp.rotation.set(-0.42, 1.32, 0.06);
				grp.scale.setScalar(2.85);
			} else {
				if (grp.parent !== this.fork) this.fork.attach(grp);
				const parallel = (w.skewerStyle === "parallel" || !w.onFork && sim.skewerStyle === "parallel") && sim.wingCount === 1;
				if (parallel) {
					grp.rotation.set(0, 0, 0);
					const onTine = w.cartilageHit ? pinch : pinch + .006;
					if (w.onFork) grp.position.set(.64 + i * .04, onTine, 0);
					else {
						grp.position.set(.78, pinch + .01, .02);
						grp.rotation.z = Math.sin(this.t * 1.6) * .04;
					}
				} else {
					// Paddle on its long edge so the two tines pin both bones.
					grp.rotation.set(Math.PI / 2, 0, 0);
					grp.position.set(.66 + (sim.wingCount === 2 ? (i - .5) * .08 : 0), 0, w.onFork ? 0 : .02);
				}
				grp.scale.set(w.size * 1.32, w.size * 1.32, w.size * 1.32 * (w.onFork || sim.phase === "skewer" ? 1 : .92));
				if (parallel) {
					grp.rotation.z = !w.cartilageHit && w.onFork ? w.hangVel * .04 : grp.rotation.z;
				} else {
					grp.rotation.z = 0;
					grp.rotation.x = Math.PI / 2 + (w.onFork ? w.hang : 0);
				}
				if (sim.phase === "skewer" && parallel && !w.onFork) {
					const aim = 1 - Math.min(1, Math.abs(sim.angle) * .9 + Math.abs(sim.distance - .55) * .5);
					grp.traverse((o) => {
						if (o.name !== "knuckle" || !(o instanceof THREE.Mesh)) return;
						const km = asStd(o.material);
						km.emissive.setHex(aim >= .62 ? 7004026 : 0);
						km.emissiveIntensity = aim >= .62 ? .55 : 0;
					});
				} else grp.traverse((o) => {
					if (o.name !== "knuckle" || !(o instanceof THREE.Mesh)) return;
					const km = asStd(o.material);
					if (km.emissiveIntensity > 0) {
						km.emissive.setHex(0);
						km.emissiveIntensity = 0;
					}
				});
			}
		});
		if (sim.phase === "honey" || sim.phase === "roast2" || sim.phase === "plate") {
			const liquid = this.bowl.getObjectByName("liquid");
			if (liquid) {
				const lm = asStd(asMesh(liquid).material);
				const soy = sim.glaze === "soy";
				lm.color.setHex(soy ? 3808784 : 12876306);
				lm.emissive.setHex(soy ? 1181700 : 3807744);
				lm.emissiveIntensity = soy ? .12 : .2;
			}
		}
		if (sim.phase === "honey") this.bowl.position.y = quiet ? .42 : .42 + Math.sin(this.t * 2) * .01;
		if (sim.wings.some((w, i) => {
			const was = this.prevOnPlate[i] ?? false;
			this.prevOnPlate[i] = !!w.onPlate;
			return w.onPlate && !was;
		}) && !quiet) {
			this.plateBounce = 1;
			this.spawnSteamPuff(sim);
		}
		this.plateBounce = Math.max(0, this.plateBounce - dt * 4.5);
		const plateY = .44 + this.plateBounce * .028 * Math.sin(this.plateBounce * Math.PI);
		if (sim.phase === "plate" || sim.phase === "extract" || sim.phase === "score") this.plate.position.y = plateY;
		else this.plate.position.y = .44;
		this.steam.forEach((p) => {
			const life = p.userData.life - dt;
			p.userData.life = life;
			p.position.y += p.userData.vy * dt;
			p.position.x += p.userData.vx * dt;
			p.position.z += p.userData.vz * dt;
			p.userData.vy = p.userData.vy * .98 + .08 * dt;
			const s = .6 + (1 - life / p.userData.maxLife) * 1.4;
			p.scale.setScalar(s * p.userData.baseScale);
			const mat = asPhys(p.material);
			mat.opacity = Math.max(0, life / p.userData.maxLife * .55);
		});
		this.steam = this.steam.filter((p) => {
			if (p.userData.life <= 0) {
				this.scene.remove(p);
				return false;
			}
			return true;
		});
		if (sim.phase === "honey" || sim.phase === "roast2") {
			const over = sim.wings.some((w) => w.honey > .72);
			const coatHeavy = sim.phase === "honey" && sim.coat > .55;
			const rate = over ? 5.5 : coatHeavy ? 2.2 : 0;
			if (rate > 0 && this.drips.length < 10 && Math.random() < dt * rate) {
				const len = .022 + Math.random() * .04;
				const d = new THREE.Mesh(new THREE.CapsuleGeometry(.006 + Math.random() * .004, len, 4, 8), new THREE.MeshPhysicalMaterial({
					color: 12876306,
					roughness: .06,
					metalness: .18,
					transmission: .4,
					thickness: .02,
					transparent: true,
					opacity: .9,
					emissive: 3807232,
					emissiveIntensity: .38,
					clearcoat: 1,
					clearcoatRoughness: .04
				}));
				const wingIdx = Math.floor(Math.random() * Math.max(1, sim.wings.length));
				const srcWing = this.wings[wingIdx];
				if (srcWing) {
					d.position.copy(srcWing.getWorldPosition(new THREE.Vector3()));
					d.position.y -= .06 + Math.random() * .04;
					d.position.x += (Math.random() - .5) * .06;
					d.position.z += (Math.random() - .5) * .04;
				} else {
					d.position.copy(this.fork.position);
					d.position.y -= .1;
				}
				d.rotation.z = (Math.random() - .5) * .35;
				d.rotation.x = (Math.random() - .5) * .2;
				d.userData.vy = .35 + Math.random() * .35;
				d.userData.stretch = 1;
				this.scene.add(d);
				this.drips.push(d);
			}
		}
		this.drips.forEach((d) => {
			const vy = d.userData.vy || .55;
			d.position.y -= dt * vy;
			d.userData.vy = vy + dt * 1.1;
			const stretch = Math.min(2.2, 1 + (.7 - d.position.y) * 1.4);
			d.userData.stretch = stretch;
			d.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));
		});
		this.drips = this.drips.filter((d) => {
			if (d.position.y < .34) {
				this.spawnPool(d.position.x, d.position.z);
				this.scene.remove(d);
				return false;
			}
			return true;
		});
		this.pools.forEach((p) => {
			const s = p.scale.x;
			if (s < 1) p.scale.setScalar(s + dt * 1.6);
			const mat = asPhys(p.material);
			mat.opacity = Math.max(.15, mat.opacity - dt * .04);
		});
		this.tongs.visible = sim.phase === "extract" || sim.phase === "plate";
		const acc = ((!this.tongs.visible ? 0 : sim.phase === "extract" ? Math.min(1, sim.extractForce * 1.55) : .22) - this.tongClose) * 28 - this.tongVel * 7.5;
		this.tongVel += acc * dt;
		this.tongClose = Math.max(-.08, Math.min(1.15, this.tongClose + this.tongVel * dt));
		if (this.tongs.visible) {
			const close = Math.max(0, Math.min(1, this.tongClose));
			const wing = this.wings[0];
			const targetX = wing && sim.phase === "extract" ? wing.position.x + .12 : .78 + sim.angle * .15;
			const targetY = .58 + close * .14;
			const targetZ = wing && sim.phase === "extract" ? wing.position.z + .08 : .52;
			this.tongs.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), Math.min(1, dt * 8));
			this.tongs.rotation.z = -.28 + close * .42;
			this.tongs.rotation.y = quiet ? 0 : Math.sin(this.t * 1.8) * .035 * (1 - close);
			this.tongs.rotation.x = close * .12;
			const openY = .038 - close * .034;
			this.tongA.position.y = openY;
			this.tongB.position.y = -openY;
			this.tongTipA.position.y = openY;
			this.tongTipB.position.y = -openY;
			const armScale = 1 - close * .04;
			this.tongA.scale.set(armScale, 1, 1);
			this.tongB.scale.set(armScale, 1, 1);
		} else {
			this.tongVel = 0;
			this.tongClose = 0;
		}
		const roast = sim.phase === "roast1" || sim.phase === "roast2";
		this.sweetRing.visible = roast;
		if (roast) {
			const inSweet = sim.distance >= .38 && sim.distance <= .62;
			const mat = asBasic(this.sweetRing.material);
			mat.color.setHex(inSweet ? 8257434 : 16742976);
			const pulse = quiet ? 0 : Math.sin(this.t * 4) * .05;
			mat.opacity = .22 + (inSweet ? .28 : .12) + pulse;
			const ringR = .2 + sim.distance * .12;
			this.sweetRing.scale.setScalar(.9 + ringR * .5);
		}
		this.aimGhost.visible = false;
		if (this.aimGhost.visible) {
			this.poseHeldFork(this.aimGhost, 0, .55);
			const mat = asBasic(asMesh(this.aimGhost.children[0]).material);
			const aimOk = Math.abs(sim.angle) < .28 && Math.abs(sim.distance - .55) < .22;
			mat.opacity = aimOk ? .45 : .22;
			mat.color.setHex(aimOk ? 9306032 : 11064575);
		}
		if (sim.phase === "skewer" && sim.thrust >= .72 && this.prevThrust < .72) {
			this.spawnSkewerSparks();
			skewerPing();
		}
		this.prevThrust = sim.thrust;
		this.tickSparks(dt);
		this.fillLight.position.set(this._tines.x + .08, this._tines.y + .08, this._tines.z + .12);
		this.fillLight.intensity = roast ? sim.wingCount === 2 ? 1.7 : 1.85 : 1.2;
		const twoRoast = sim.wingCount === 2 && (sim.phase === "roast1" || sim.phase === "roast2" || sim.phase === "honey");
		this.occludeLight.visible = twoRoast;
		this.wingKey.visible = twoRoast || roast || sim.phase === "skewer" || sim.phase === "pick" || sim.phase === "title";
		if (twoRoast) {
			const w0 = this.wings[0];
			const w1 = this.wings[1];
			if (w0 && w1) {
				const a = new THREE.Vector3();
				const b = new THREE.Vector3();
				w0.getWorldPosition(a);
				w1.getWorldPosition(b);
				const mid = a.clone().add(b).multiplyScalar(.5);
				mid.y -= .015;
				mid.z += .02;
				this.occludeLight.position.copy(mid);
				const stack = 1 - Math.min(1, Math.abs(sim.angle) * 1.4);
				const avgHeat = sim.wings.reduce((s, w) => s + w.heat, 0) / Math.max(1, sim.wings.length);
				this.occludeLight.intensity = .45 + stack * .75 + Math.min(.4, avgHeat * .25);
				this.occludeLight.distance = .68 + stack * .32;
				this.wingKey.position.set(b.x + .14, b.y + .07, b.z + .1);
				this.wingKey.intensity = .55 + (1 - stack) * .4;
			} else {
				this.occludeLight.position.set(this.fork.position.x - .02, this.fork.position.y - .02, this.fork.position.z + .02);
				this.occludeLight.intensity = .4 + Math.abs(sim.angle) * .3;
			}
		} else if (this.wingKey.visible) {
			this.wingKey.position.set(this._tines.x + .02, this._tines.y + .1, this._tines.z + .16);
			this.wingKey.intensity = sim.phase === "pick" ? .55 : sim.phase === "skewer" ? 1.65 : .95;
		}
		const pos = this.coals.geometry.attributes.position;
		const drift = sim.wind * .18;
		for (let i = 0; i < pos.count; i++) {
			let y = pos.getY(i) + dt * (.15 + i % 5 * .05);
			let x = pos.getX(i) + dt * drift;
			if (y > .82) {
				y = .44;
				x = (Math.random() - .5) * .5;
			}
			if (x > .32) x = -.25;
			if (x < -.32) x = .25;
			pos.setX(i, x);
			pos.setY(i, y);
		}
		pos.needsUpdate = true;
		const ghostOn = (sim.phase === "roast1" || sim.phase === "roast2") && sim.ghost && sim.ghost.length > 4;
		this.ghostFork.visible = Boolean(ghostOn);
		if (ghostOn && sim.ghost) {
			const sample = sim.ghost[Math.min(sim.ghost.length - 1, Math.floor(sim.cookClock / .1 % sim.ghost.length))];
			this.poseHeldFork(this.ghostFork, sample.angle, sample.distance, .02);
		}
		this.board.visible = sim.phase === "pick" || sim.phase === "count";
		if (this.board.visible) {
			for (const kind of ["marinated", "plain"] as const) {
				const bag = this.shopBags[kind];
				bag.visible = true;
				bag.position.x = kind === "marinated" ? -.3 : .3;
				bag.position.y = .2;
				bag.position.z = -.06;
				bag.rotation.x = 0;
				const pulse = quiet ? 0 : Math.sin(this.t * 2.2 + (kind === "marinated" ? 0 : 1.1)) * .018;
				bag.scale.setScalar(1 + pulse);
				const guts = bag.getObjectByName("guts");
				if (guts) guts.visible = true;
			}
		}
		if (this.npc) {
			const quietNpc = prefersReducedMotion();
			const nx = quietNpc ? -2.2 : -2.6 + Math.sin(this.t * .12) * 2.4;
			this.npc.position.x = nx;
			this.npc.position.z = -1.15 + Math.sin(this.t * .07) * .15;
			if (!quietNpc) {
				const dx = Math.abs(nx - this.lastNpcX);
				this.npcStepAcc += dx;
				this.lastNpcX = nx;
				if (this.npcStepAcc > .4) {
					this.npcStepAcc = 0;
					footstep(Math.max(-.8, Math.min(.8, nx * .35)));
				}
			}
		}
		if (sim.fatDrip > .2 && (sim.phase === "roast1" || sim.phase === "roast2" || sim.phase === "honey") && this.jets.length < 6 && Math.random() < dt * 8) {
			const jet = new THREE.Mesh(new THREE.ConeGeometry(.03, .16, 6), new THREE.MeshBasicMaterial({
				color: 16738848,
				transparent: true,
				opacity: .85
			}));
			jet.position.set((Math.random() - .5) * .28, .42, -.12 + (Math.random() - .5) * .16);
			jet.userData.life = .28;
			this.scene.add(jet);
			this.jets.push(jet);
			oilPop();
		}
		this.jets = this.jets.filter((j) => {
			j.userData.life -= dt;
			j.position.y += dt * .7;
			(asBasic(j.material)).opacity = Math.max(0, j.userData.life * 3);
			if (j.userData.life <= 0) {
				this.scene.remove(j);
				return false;
			}
			return true;
		});
		if (sim.phase === "score") {
			this.fork.position.lerp(new THREE.Vector3(-.4, .9, .8), .05);
			sim.wings.forEach((_, i) => {
				const grp = this.wings[i];
				if (!grp) return;
				grp.parent === this.fork && this.scene.attach(grp);
				grp.position.lerp(new THREE.Vector3(.86 + i * .16, .5, .52), .08);
			});
			const n = Math.max(1, sim.wings.length);
			this.scoreFocus = (this.scoreFocus + dt * .35) % n;
		}
		tickJuice(dt);
		const j = cameraOffset();
		const bob = quiet ? 0 : Math.sin(this.t * 1.15) * .012;
		if (sim.phase === "score") {
			const idx = Math.floor(this.scoreFocus);
			const look = new THREE.Vector3(.72 + idx * .16, .5, .32);
			this.camera.position.lerp(new THREE.Vector3(look.x + .05, 1.02, 1.15), .04);
			this.camera.lookAt(look);
		} else if (sim.phase === "pick" || sim.phase === "count") {
			this.camera.position.set(j.x, .9 + bob * .4 + j.y, 1.22);
			this._look.set(0, .68, .66);
			this.camera.lookAt(this._look);
		} else if (sim.phase === "skewer") {
			this.camera.position.lerp(new THREE.Vector3(j.x, .98 + bob + j.y, 1.22), .12);
			this._look.set(.04, .7, .2);
			this.camera.lookAt(this._look);
		} else if (sim.phase === "title") {
			this.camera.position.set(0.28 + j.x, 0.78 + bob + j.y, 1.05);
			this._look.set(0.02, 0.56, 0.18);
			this.camera.lookAt(this._look);
		} else {
			this.camera.position.set(this.camBase.x + j.x, this.camBase.y + bob + j.y, this.camBase.z);
			this._look.set(-sim.angle * .16, .52, -.08);
			this.camera.lookAt(this._look);
		}
		if (sim.phase === "title") {
			const hero = this.wings[0];
			if (hero) {
				if (hero.parent === this.fork) this.scene.attach(hero);
				hero.visible = true;
				const spin = Math.sin(this.t * 0.26) * 0.12;
				hero.position.set(0.0, 0.56, 0.2);
				hero.rotation.set(-0.42, 1.32 + spin, 0.06);
				hero.scale.setScalar(2.85);
				const mesh = hero.getObjectByName("meat");
				if (mesh && mesh instanceof THREE.Mesh) {
					this.paintWing(mesh, 0, 0, 0, 0, 0);
					const mat = asStd(mesh.material);
					mat.emissive.setHex(0x3a2018);
					mat.emissiveIntensity = 0.04;
					mat.roughness = 0.74;
					mat.metalness = 0;
				}
			}
			this.wingKey.position.set(0.22, 0.8, 0.55);
			this.wingKey.intensity = 2.4;
			this.fillLight.position.set(-0.12, 0.72, 0.62);
			this.fillLight.intensity = 1.8;
		}
		this.projectTines(sim);
		this.renderer.render(this.scene, this.camera);
	}
	spawnPool(x: number, z: number) {
		if (this.pools.length > 10) {
			const old = this.pools.shift();
			if (old) this.scene.remove(old);
		}
		const pool = new THREE.Mesh(new THREE.CircleGeometry(.035, 12), new THREE.MeshPhysicalMaterial({
			color: 12085776,
			roughness: .08,
			metalness: .2,
			transmission: .25,
			transparent: true,
			opacity: .78,
			clearcoat: .9,
			clearcoatRoughness: .06,
			emissive: 2756608,
			emissiveIntensity: .15
		}));
		pool.rotation.x = -Math.PI / 2;
		pool.position.set(x, .345, z);
		pool.scale.setScalar(.2);
		this.scene.add(pool);
		this.pools.push(pool);
	}
	/** Soft rising steam / plate-up puff when wings land on the newspaper. */
	spawnSteamPuff(sim: Sim) {
		const n = 10 + Math.floor(Math.random() * 6);
		const baseX = this.plate.position.x;
		const baseZ = this.plate.position.z;
		for (let i = 0; i < n; i++) {
			const r = .04 + Math.random() * .12;
			const a = Math.random() * Math.PI * 2;
			const geo = new THREE.SphereGeometry(.018 + Math.random() * .022, 8, 6);
			const mat = new THREE.MeshBasicMaterial({
				color: 15261908,
				transparent: true,
				opacity: .5,
				depthWrite: false
			});
			const p = new THREE.Mesh(geo, mat);
			p.position.set(baseX + Math.cos(a) * r * .7, .48 + Math.random() * .04, baseZ + Math.sin(a) * r * .55);
			const maxLife = .55 + Math.random() * .65;
			p.userData.life = maxLife;
			p.userData.maxLife = maxLife;
			p.userData.vy = .28 + Math.random() * .35;
			p.userData.vx = (Math.random() - .5) * .12;
			p.userData.vz = (Math.random() - .5) * .1;
			p.userData.baseScale = .7 + Math.random() * .6;
			p.scale.setScalar(p.userData.baseScale);
			this.scene.add(p);
			this.steam.push(p);
		}
		if (sim.wings.some((w) => w.heat > .65)) for (let i = 0; i < 4; i++) {
			const geo = new THREE.SphereGeometry(.012, 6, 5);
			const mat = new THREE.MeshBasicMaterial({
				color: 16773336,
				transparent: true,
				opacity: .35,
				depthWrite: false
			});
			const p = new THREE.Mesh(geo, mat);
			p.position.set(baseX + (Math.random() - .5) * .18, .5, baseZ + (Math.random() - .5) * .14);
			const maxLife = .4 + Math.random() * .3;
			p.userData.life = maxLife;
			p.userData.maxLife = maxLife;
			p.userData.vy = .45 + Math.random() * .25;
			p.userData.vx = (Math.random() - .5) * .08;
			p.userData.vz = (Math.random() - .5) * .06;
			p.userData.baseScale = .5;
			this.scene.add(p);
			this.steam.push(p);
		}
	}
	spawnMoths() {
		const n = STALL.moths.count;
		for (let i = 0; i < n; i++) {
			const geo = new THREE.PlaneGeometry(.028, .016);
			const mat = new THREE.MeshBasicMaterial({
				color: 13152400,
				transparent: true,
				opacity: .7,
				side: THREE.DoubleSide,
				depthWrite: false
			});
			const m = new THREE.Mesh(geo, mat);
			m.userData.phase = i / n * Math.PI * 2;
			m.userData.speed = .7 + i % 3 * .25;
			m.userData.radius = STALL.moths.radius * (.7 + i % 4 * .12);
			this.lantern.add(m);
			this.moths.push(m);
		}
	}
	tickMoths(quiet: boolean) {
		const hide = quiet && STALL.moths.hideIfReduceMotion;
		for (const m of this.moths) {
			m.visible = !hide;
			if (hide) continue;
			const ph = m.userData.phase + this.t * m.userData.speed;
			const r = m.userData.radius;
			m.position.set(Math.cos(ph) * r, -.02 + Math.sin(ph * 1.7) * .06, Math.sin(ph) * r);
			m.rotation.y = ph + Math.PI / 2;
			m.rotation.z = Math.sin(this.t * 28 + ph) * .55;
		}
	}
	spawnShimmer() {
		for (let i = 0; i < STALL.heatShimmer; i++) {
			const geo = new THREE.PlaneGeometry(.06, .14);
			const mat = new THREE.MeshBasicMaterial({
				color: 16769200,
				transparent: true,
				opacity: 0,
				depthWrite: false,
				side: THREE.DoubleSide
			});
			const p = new THREE.Mesh(geo, mat);
			p.position.set((Math.random() - .5) * .4, .42, -.1 + (Math.random() - .5) * .28);
			p.userData.seed = Math.random() * Math.PI * 2;
			this.scene.add(p);
			this.shimmer.push(p);
		}
	}
	tickShimmer(quiet: boolean, sim: Sim) {
		const hot = sim.phase === "roast1" || sim.phase === "roast2" ? .7 + Math.max(0, .7 - sim.distance) : .18;
		for (let i = 0; i < this.shimmer.length; i++) {
			const p = this.shimmer[i];
			if (quiet) {
				p.visible = false;
				continue;
			}
			p.visible = true;
			const seed = p.userData.seed;
			const y = .4 + (this.t * .22 + seed) % .45;
			p.position.y = y;
			p.position.x = Math.sin(this.t * 1.4 + seed) * .16 + sim.wind * .12;
			const life = 1 - (y - .4) / .45;
			asBasic(p.material).opacity = quiet ? 0 : hot * .12 * life;
		}
	}
	spawnSkewerSparks() {
		const origin = this.fork.localToWorld(new THREE.Vector3(.72, 0, 0));
		for (let i = 0; i < 10; i++) {
			const cone = new THREE.Mesh(new THREE.ConeGeometry(.012, .05, 5), new THREE.MeshBasicMaterial({
				color: 16769162,
				transparent: true,
				opacity: .95
			}));
			cone.position.copy(origin);
			cone.position.x += (Math.random() - .5) * .04;
			cone.position.y += (Math.random() - .5) * .03;
			cone.userData.v = new THREE.Vector3((Math.random() - .5) * .6, .4 + Math.random() * .8, (Math.random() - .5) * .6);
			cone.userData.life = .28 + Math.random() * .12;
			this.scene.add(cone);
			this.sparks.push(cone);
		}
	}
	tickSparks(dt: number) {
		this.sparks = this.sparks.filter((s) => {
			const v = s.userData.v;
			s.position.addScaledVector(v, dt);
			v.y -= 2.4 * dt;
			s.userData.life -= dt;
			asBasic(s.material).opacity = Math.max(0, s.userData.life * 3);
			if (s.userData.life <= 0) {
				this.scene.remove(s);
				s.geometry.dispose();
				asBasic(s.material).dispose();
				return false;
			}
			return true;
		});
	}
	updateSkewerAim(sim: Sim, grp: THREE.Group) {
		const tA = grp.getObjectByName("targetA");
		const tB = grp.getObjectByName("targetB");
		if (!tA || !tB) {
			sim.skewerAim = 0.4;
			return;
		}
		const a = tA.getWorldPosition(new THREE.Vector3());
		const b = tB.getWorldPosition(new THREE.Vector3());
		const tipA = this.tineWorld(1);
		const tipB = this.tineWorld(-1);
		const d1 = tipA.distanceTo(a) + tipB.distanceTo(b);
		const d2 = tipA.distanceTo(b) + tipB.distanceTo(a);
		const d = Math.min(d1, d2);
		sim.skewerAim = Math.max(0, Math.min(1, 1 - d / 0.18));
	}
	tineWorld(side: number) {
		const named = this.tines.getObjectByName(side > 0 ? "tipA" : "tipB");
		const v = new THREE.Vector3();
		if (named) {
			named.getWorldPosition(v);
			return v;
		}
		v.set(.88, side * .022, 0);
		this.tines.updateWorldMatrix(true, false);
		this.tines.localToWorld(v);
		return v;
	}
	projectTines(sim: Sim) {
		const show = sim.phase === "skewer" && !sim.wings.every((w) => w.onFork);
		for (let i = 0; i < 2; i++) {
			const side = i === 0 ? 1 : -1;
			const p = this.tineWorld(side);
			p.project(this.camera);
			const on = show && p.z > -1 && p.z < 1 && Math.abs(p.x) < 1.4 && Math.abs(p.y) < 1.4;
			this.tineScreen[i] = {
				x: (p.x * .5 + .5) * 100,
				y: (-p.y * .5 + .5) * 100,
				visible: on,
			};
		}
	}
	pickAt(clientX: number, clientY: number): { kind: "bag"; bag: BagKind } | null {
		const rect = this.renderer.domElement.getBoundingClientRect();
		const ndc = new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
		const ray = new THREE.Raycaster();
		ray.setFromCamera(ndc, this.camera);
		const bags = [this.shopBags.marinated, this.shopBags.plain];
		const bagObj = ray.intersectObjects(bags, true)[0]?.object;
		const bagRoot = bagObj ? this.findPickRoot(bagObj) : null;
		if (bagRoot?.userData.bag) return {
			kind: "bag",
			bag: bagRoot.userData.bag as BagKind
		};
		return null;
	}
	findPickRoot(obj: THREE.Object3D): THREE.Object3D {
		let o: THREE.Object3D | null = obj;
		while (o) {
			if (o.userData.pickKind || o.userData.bag) return o;
			o = o.parent;
		}
		return obj;
	}
	dispose() {
		this.renderer.dispose();
	}
}
