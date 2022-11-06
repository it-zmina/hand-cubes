import * as THREE from 'three'
import {VRButton} from "three/examples/jsm/webxr/VRButton"
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader";
import {DRACOLoader} from "three/examples/jsm/loaders/DRACOLoader"
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import {XRControllerModelFactory} from "three/examples/jsm/webxr/XRControllerModelFactory";
import {XRHandModelFactory} from "three/examples/jsm/webxr/XRHandModelFactory";

const assetsPath = "profiles/"

import blimp from "../assets/Blimp.glb"

class App {
    constructor() {
        const container = document.createElement('div')
        document.body.appendChild(container)

        this.camera = new THREE.PerspectiveCamera(50,
            window.innerWidth / window.innerHeight, 0.1, 200)
        this.camera.position.set(0, 1.6, 3)

        this.scene = new THREE.Scene()
        this.scene.background = new THREE.Color(0x505050)

        const ambient = new THREE.HemisphereLight(0x606060, 0x404040, 1)
        this.scene.add(ambient)

        const light = new THREE.DirectionalLight(0xffffff)
        light.position.set(1, 1, 1).normalize()
        this.scene.add(light)

        this.controls = new OrbitControls(this.camera, container);
        this.controls.target.set(0, 1.6, 0);
        this.controls.update();

        this.initFloor()

        this.renderer = new THREE.WebGLRenderer({antialias: true})
        this.renderer.setPixelRatio(window.devicePixelRatio)
        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.renderer.outputEncoding = THREE.sRGBEncoding
        this.renderer.shadowMap.enabled = true;
        this.renderer.xr.enabled = true;

        container.appendChild(this.renderer.domElement)

        this.initScene()
        this.setupVR()

        window.addEventListener('resize', this.resize.bind(this))
        this.renderer.setAnimationLoop(this.render.bind(this))
    }

    initFloor() {
        const floorGeometry = new THREE.PlaneGeometry(4, 4);
        const floorMaterial = new THREE.MeshStandardMaterial({color: 0x222222});
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        this.scene.add(new THREE.HemisphereLight(0x808080, 0x606060));

        const light = new THREE.DirectionalLight(0xffffff);
        light.position.set(0, 6, 0);
        light.castShadow = true;
        light.shadow.camera.top = 2;
        light.shadow.camera.bottom = -2;
        light.shadow.camera.right = 2;
        light.shadow.camera.left = -2;
        light.shadow.mapSize.set(4096, 4096);
        this.scene.add(light);
    }

    initScene() {
        const self = this
        const geometry = new THREE.BoxBufferGeometry(.5, .5, .5)
        const material = new THREE.MeshStandardMaterial({color: 0xFF0000})
        this.mesh = new THREE.Mesh(geometry, material)
        this.scene.add(this.mesh)

        const geometrySphere = new THREE.SphereGeometry(.7, 32, 16)
        const materialSphere = new THREE.MeshBasicMaterial({color: 0xffff00})
        const sphere = new THREE.Mesh(geometrySphere, materialSphere)
        this.scene.add(sphere)

        sphere.position.set(1.5, 0, 0)

        this.loadAsset(blimp, -.5, .5, 1, scene => {
            const scale = 5
            scene.scale.set(scale, scale, scale)
            self.blimp = scene
        })
    }

    loadAsset(gltfFilename, x, y, z, sceneHandler) {
        const self = this
        const loader = new GLTFLoader()
        // Provide a DRACOLoader instance to decode compressed mesh data
        const draco = new DRACOLoader()
        draco.setDecoderPath('draco/')
        loader.setDRACOLoader(draco)

        loader.load(gltfFilename, (gltf) => {
                const gltfScene = gltf.scene
                self.scene.add(gltfScene)
                gltfScene.position.set(x, y, z)
                if (sceneHandler) {
                    sceneHandler(gltfScene)
                }
            },
            null,
            (error) => console.error(`An error happened: ${error}`)
        )
    }

    setupVR() {
        this.renderer.xr.enabled = true
        document.body.appendChild(VRButton.createButton(this.renderer))
        // Possible values: viewer,local,local-floor,bounded-floor,unbounded
        this.renderer.xr.setReferenceSpaceType('local-floor')
        const controllerModel = new XRControllerModelFactory()

        // Add left grip controller
        const gripRight = this.renderer.xr.getControllerGrip(0)
        this.controllerL =
            gripRight.add(controllerModel.createControllerModel(gripRight))
        this.scene.add(gripRight)

        // Add right grip controller
        const gripLeft = this.renderer.xr.getControllerGrip(1)
        gripLeft.add(controllerModel.createControllerModel(gripLeft))
        this.scene.add(gripLeft)

        this.gripLeft = gripLeft
        this.gripRight = gripRight

        // Add beams
        const geometry = new THREE.BufferGeometry()
            .setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, -1)
            ])
        const line = new THREE.Line(geometry)
        line.name = 'line'
        line.scale.z = 5

        gripRight.add(line.clone())
        gripLeft.add(line.clone())

        // Add hands
        this.handModels = {left: null, right: null}
        this.currentHandModel = {left: 0, right: 0}

        const handModelFactory = new XRHandModelFactory()

        this.hand1 = this.renderer.xr.getHand(1);
        this.scene.add(this.hand1);

        this.handModels.right = [
            handModelFactory.createHandModel(this.hand1, "boxes"),
            handModelFactory.createHandModel(this.hand1, "spheres"),
            handModelFactory.createHandModel(this.hand1, 'mesh'),
        ];

        this.handModels.right.forEach(model => {
            model.visible = false;
            this.hand1.add(model);
        });

        this.handModels.right[this.currentHandModel.right].visible = true;

        // Hand 2
        this.hand0 = this.renderer.xr.getHand(0);
        this.scene.add(this.hand0);

        this.handModels.left = [
            handModelFactory.createHandModel(this.hand0, "boxes"),
            handModelFactory.createHandModel(this.hand0, "spheres"),
            handModelFactory.createHandModel(this.hand0, 'mesh'),
        ];

        this.handModels.left.forEach(model => {
            model.visible = false;
            this.hand0.add(model);
        });

        this.handModels.left[this.currentHandModel.left].visible = true;

        this.addActions()
    }

    addActions() {
        const self = this;

        this.gripRight.addEventListener('selectstart', evt => {
            self.blimp.rotateY(45)
        })

        this.gripRight.addEventListener('squeezestart', evt => {
            self.blimp.translateY(.1)
        })

        this.gripLeft.addEventListener('selectstart', evt => {
            self.blimp.rotateY(-45)
        })

        this.gripLeft.addEventListener('squeezestart', evt => {
            self.blimp.translateY(-.1)
        })

        this.hand1.addEventListener('pinchend', evt => {
            self.changeAngle.bind(self, evt.handedness).call();
        });

        this.hand1.addEventListener('pinchend', evt => {
            self.handModels.right[self.currentHandModel.right].visible = false
            self.currentHandModel.right = (self.currentHandModel.right + 1) % self.handModels.right.length
            self.handModels.right[self.currentHandModel.right].visible = true
        });

        this.hand0.addEventListener('pinchend', evt => {
            self.handModels.left[self.currentHandModel.left].visible = false
            self.currentHandModel.left = (self.currentHandModel.left + 1) % self.handModels.left.length
            self.handModels.left[self.currentHandModel.left].visible = true
        });
    }

    changeAngle(handedness) {
        if (blimp) {
            this.blimp.rotateY(45)
        }
    }

    cycleHandModel(hand) {
        this.handModels[hand][this.currentHandModel[hand]].visible = false;
        this.currentHandModel[hand] = (this.currentHandModel[hand] + 1) % this.handModels[hand].length;
        this.handModels[hand][this.currentHandModel[hand]].visible = true;
    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight
        this.camera.updateProjectionMatrix()
        this.renderer.setSize(window.innerWidth, window.innerHeight)
    }

    render() {
        if (this.mesh) {
            this.mesh.rotateX(0.005)
            this.mesh.rotateY(0.01)
        }

        // if (this.blimp) {
        //   this.blimp.rotateY(0.1 * xAxis)
        //   this.blimp.translateY(.02 * yAxis)
        // }
        this.renderer.render(this.scene, this.camera)
    }
}

export {App}
