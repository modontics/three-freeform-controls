import * as THREE from "three";
import Translation from "./translation";
import { DEFAULT_CONTROLS_SEPARATION } from "../utils/constants";
import Rotation from "./rotation";

enum HANDLE_NAMES {
  X = "x_handle",
  Y = "y_handle",
  Z = "z_handle"
}

export default class Controls extends THREE.Group {
  private readonly translationXP: Translation;
  private readonly translationYP: Translation;
  private readonly translationZP: Translation;
  private readonly translationXN: Translation;
  private readonly translationYN: Translation;
  private readonly translationZN: Translation;
  private readonly rotationX: Rotation;
  private readonly rotationY: Rotation;
  private readonly rotationZ: Rotation;
  private handleTargetQuaternion = new THREE.Quaternion();
  private handleTargetEuler = new THREE.Euler();
  private objectWorldPosition = new THREE.Vector3();
  private objectTargetPosition = new THREE.Vector3();
  private objectTargetQuaternion = new THREE.Quaternion();
  private objectParentWorldPosition = new THREE.Vector3();
  private objectParentWorldQuaternion = new THREE.Quaternion();
  private objectParentWorldScale = new THREE.Vector3();
  private deltaQuaternion = new THREE.Quaternion();
  private touch1 = new THREE.Vector3();
  private touch2 = new THREE.Vector3();
  private minBox = new THREE.Vector3();
  private maxBox = new THREE.Vector3();
  private dragStartPoint = new THREE.Vector3();
  private dragIncrementalStartPoint = new THREE.Vector3();
  public isBeingDraggedTranslation = false;
  public isBeingDraggedRotation = false;

  constructor(public object: THREE.Mesh) {
    super();

    this.computeObjectBounds();

    this.translationXP = new Translation("red");
    this.translationYP = new Translation("green");
    this.translationZP = new Translation("blue");

    this.translationXN = new Translation("red");
    this.translationYN = new Translation("green");
    this.translationZN = new Translation("blue");

    this.rotationX = new Rotation("red");
    this.rotationY = new Rotation("green");
    this.rotationZ = new Rotation("blue");

    this.setupTranslation();
    this.setupRotation();
  }

  private setupTranslation = () => {
    this.translationXP.name = HANDLE_NAMES.X;
    this.translationYP.name = HANDLE_NAMES.Y;
    this.translationZP.name = HANDLE_NAMES.Z;

    this.translationXN.name = HANDLE_NAMES.X;
    this.translationYN.name = HANDLE_NAMES.Y;
    this.translationZN.name = HANDLE_NAMES.Z;

    this.translationXP.translateX(this.maxBox.x);
    this.translationYP.translateY(this.maxBox.y);
    this.translationZP.translateZ(this.maxBox.z);

    this.translationXN.translateX(this.minBox.x);
    this.translationYN.translateY(this.minBox.y);
    this.translationZN.translateZ(this.minBox.z);

    this.translationXP.rotateZ(-Math.PI / 2);
    this.translationZP.rotateX(Math.PI / 2);

    this.translationXN.rotateZ(Math.PI / 2);
    this.translationYN.rotateX(Math.PI);
    this.translationZN.rotateX(-Math.PI / 2);

    this.translationXP.up = new THREE.Vector3(0, 1, 0);
    this.translationYP.up = new THREE.Vector3(0, 0, 1);
    this.translationZP.up = new THREE.Vector3(0, 1, 0);

    this.translationXN.up = new THREE.Vector3(0, 1, 0);
    this.translationYN.up = new THREE.Vector3(0, 0, 1);
    this.translationZN.up = new THREE.Vector3(0, 1, 0);

    this.add(this.translationXP);
    this.add(this.translationYP);
    this.add(this.translationZP);

    this.add(this.translationXN);
    this.add(this.translationYN);
    this.add(this.translationZN);
  };

  private setupRotation = () => {
    this.rotationX.name = HANDLE_NAMES.X;
    this.rotationY.name = HANDLE_NAMES.Y;
    this.rotationZ.name = HANDLE_NAMES.Z;

    this.rotationX.up = new THREE.Vector3(1, 0, 0);
    this.rotationY.up = new THREE.Vector3(0, 1, 0);
    this.rotationZ.up = new THREE.Vector3(0, 0, 1);

    this.rotationX.rotateY(Math.PI / 2);
    this.rotationY.rotateX(Math.PI / 2);

    this.add(this.rotationX);
    this.add(this.rotationY);
    this.add(this.rotationZ);
  };

  private computeObjectBounds = () => {
    this.object.geometry.computeBoundingBox();
    const {
      boundingBox: { min, max }
    } = this.object.geometry;
    this.minBox.copy(min);
    this.maxBox.copy(max);
    this.minBox.addScalar(-DEFAULT_CONTROLS_SEPARATION);
    this.maxBox.addScalar(DEFAULT_CONTROLS_SEPARATION);
  };

  processDragStart = (args: { point: THREE.Vector3; handle: Rotation | Translation }) => {
    const { point, handle } = args;
    this.dragStartPoint.copy(point);
    this.dragIncrementalStartPoint.copy(point);
    this.isBeingDraggedTranslation = handle instanceof Translation;
    this.isBeingDraggedRotation = handle instanceof Rotation;
  };

  processHandle = (args: { point: THREE.Vector3; handle: Rotation | Translation }) => {
    const { point, handle } = args;
    if (handle instanceof Translation) {
      if (handle.name === HANDLE_NAMES.X) {
        this.position.x += point.x - this.dragIncrementalStartPoint.x;
      } else if (handle.name === HANDLE_NAMES.Y) {
        this.position.y += point.y - this.dragIncrementalStartPoint.y;
      } else if (handle.name === HANDLE_NAMES.Z) {
        this.position.z += point.z - this.dragIncrementalStartPoint.z;
      }
    } else {
      this.touch1
        .copy(this.dragStartPoint)
        .sub(this.position)
        .normalize();
      this.touch2
        .copy(point)
        .sub(this.position)
        .normalize();

      this.touch1 // touch1 can be reused
        .copy(this.dragIncrementalStartPoint)
        .sub(this.position)
        .normalize();
      this.handleTargetQuaternion.setFromUnitVectors(this.touch1, this.touch2);
      this.handleTargetEuler.setFromQuaternion(this.handleTargetQuaternion);

      if (handle.name === HANDLE_NAMES.X) {
        this.deltaQuaternion.setFromAxisAngle(handle.up, this.handleTargetEuler.x);
        handle.rotation.x += this.handleTargetEuler.x;
      } else if (handle.name === HANDLE_NAMES.Y) {
        this.deltaQuaternion.setFromAxisAngle(handle.up, this.handleTargetEuler.y);
        handle.rotation.z += -this.handleTargetEuler.y;
      } else if (handle.name === HANDLE_NAMES.Z) {
        this.deltaQuaternion.setFromAxisAngle(handle.up, this.handleTargetEuler.z);
        handle.rotation.z += this.handleTargetEuler.z;
      }
    }

    this.objectTargetQuaternion.premultiply(this.deltaQuaternion);
    this.dragIncrementalStartPoint.copy(point);
  };

  private detachObjectUpdatePositionAttach = (
    parent: THREE.Object3D | null,
    object: THREE.Object3D
  ) => {
    if (parent !== null && this.parent !== null && this.parent.parent !== null) {
      const scene = this.parent.parent;
      scene.attach(object);
      object.position.copy(this.objectTargetPosition);
      parent.attach(object);
    }
  };

  public showXT = (visibility = true) => {
    this.translationXP.visible = visibility;
    this.translationXN.visible = visibility;
  };

  public showYT = (visibility = true) => {
    this.translationYP.visible = visibility;
    this.translationYN.visible = visibility;
  };

  public showZT = (visibility = true) => {
    this.translationZP.visible = visibility;
    this.translationZN.visible = visibility;
  };

  public showXR = (visibility = true) => {
    this.rotationX.visible = visibility;
  };

  public showYR = (visibility = true) => {
    this.rotationY.visible = visibility;
  };

  public showZR = (visibility = true) => {
    this.rotationZ.visible = visibility;
  };

  updateMatrixWorld = (force?: boolean) => {
    this.object.updateMatrixWorld(force);

    this.object.getWorldPosition(this.objectWorldPosition);
    const parent = this.object.parent;
    if (parent !== null) {
      parent.matrixWorld.decompose(
        this.objectParentWorldPosition,
        this.objectParentWorldQuaternion,
        this.objectParentWorldScale
      );
    }
    this.objectParentWorldQuaternion.inverse();
    this.objectTargetPosition.copy(this.position);
    this.objectTargetQuaternion.premultiply(this.objectParentWorldQuaternion);

    if (this.isBeingDraggedTranslation) {
      this.detachObjectUpdatePositionAttach(parent, this.object);
    } else if (this.isBeingDraggedRotation) {
      this.object.quaternion.copy(this.objectTargetQuaternion);
      this.detachObjectUpdatePositionAttach(parent, this.object);
    } else {
      this.position.copy(this.objectWorldPosition);
    }

    this.object.getWorldQuaternion(this.objectTargetQuaternion);

    super.updateMatrixWorld(force);
  };
}
