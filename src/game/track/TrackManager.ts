import * as THREE from 'three';
import { TrackChunk, type TrackChunkConfig } from './TrackChunk';

export class TrackManager {
  public static readonly LANE_WIDTH = 2.4;
  public static readonly LANE_X_POSITIONS = {
    [-1]: -TrackManager.LANE_WIDTH, // Left
    [0]: 0,                          // Center
    [1]: TrackManager.LANE_WIDTH,    // Right
  };

  public readonly group: THREE.Group;
  private chunks: TrackChunk[] = [];
  private chunkLength: number = 40;
  private chunkCount: number = 8;
  public speed: number = 22; // units per second (~80 km/h)
  public distanceRun: number = 0;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    const config: TrackChunkConfig = {
      length: this.chunkLength,
      laneWidth: TrackManager.LANE_WIDTH,
      roadWidth: TrackManager.LANE_WIDTH * 3 + 1.2,
    };

    // Instantiate consecutive chunks spanning from behind player (z = +20) out to the horizon (z = -260)
    for (let i = 0; i < this.chunkCount; i++) {
      const chunk = new TrackChunk(i, config);
      const zPos = 20 - i * this.chunkLength;
      chunk.setPositionZ(zPos);
      this.chunks.push(chunk);
      this.group.add(chunk.group);
    }
  }

  public update(delta: number): void {
    const moveDistance = this.speed * delta;
    this.distanceRun += moveDistance;

    // Move chunks toward the camera (positive Z)
    for (const chunk of this.chunks) {
      chunk.setPositionZ(chunk.getPositionZ() + moveDistance);
    }

    // Find the furthest chunk in the back (most negative Z)
    let minZ = 0;
    for (const chunk of this.chunks) {
      if (chunk.getPositionZ() < minZ) {
        minZ = chunk.getPositionZ();
      }
    }

    // Recycle any chunk that has moved behind the camera
    const recycleThreshold = 35; // Behind the camera view
    for (const chunk of this.chunks) {
      if (chunk.getPositionZ() > recycleThreshold) {
        // Place it behind the furthest chunk
        chunk.setPositionZ(minZ - this.chunkLength);
        minZ = chunk.getPositionZ();
      }
    }
  }

  public static getLaneX(lane: number): number {
    if (lane < 0) return TrackManager.LANE_X_POSITIONS[-1];
    if (lane > 0) return TrackManager.LANE_X_POSITIONS[1];
    return TrackManager.LANE_X_POSITIONS[0];
  }

  public setSpeed(newSpeed: number): void {
    this.speed = newSpeed;
  }
}
