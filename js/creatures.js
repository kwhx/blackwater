export class GreenlandShark {
  constructor() {
    this.numSegs = 14;
    this.x = 0.35;
    this.y = 0.45;
    this.angle = 0.45;
    this.targetAngle = 0.45;
    this.speed = 0.00038;
    this.tailPhase = 0;
    this.tailFreq = 1.1;
    this.depth = 0.25;
    this.targetDepth = 0.35;

    this.radii = [
      0.024, 0.032, 0.038, 0.041, 0.040,
      0.038, 0.035, 0.030, 0.025, 0.020,
      0.016, 0.012, 0.009, 0.007
    ];
    this.spacing = 0.022;

    this.segs = [];
    for (let i = 0; i < this.numSegs; i++) {
      this.segs.push({
        x: this.x - Math.cos(this.angle) * i * this.spacing,
        y: this.y - Math.sin(this.angle) * i * this.spacing,
        r: this.radii[i]
      });
    }

    this.turnTimer = 3.0;
  }

  update(dt, scrollProgress, fluidVelSample) {
    const step = dt * 0.016;
    this.tailPhase += step * this.tailFreq;

    const targetScrollDepth = 0.18 + Math.sin(scrollProgress * Math.PI * 1.8) * 0.30;
    this.depth += (targetScrollDepth - this.depth) * 0.03 * dt;

    this.turnTimer -= step;
    if (this.turnTimer <= 0) {
      this.targetAngle += (Math.random() - 0.5) * 0.9;
      this.turnTimer = 4.0 + Math.random() * 4.0;
    }

    const margin = 0.12;
    if (this.x < margin) this.targetAngle = 0.0;
    else if (this.x > 1.0 - margin) this.targetAngle = Math.PI;
    if (this.y < margin) this.targetAngle = Math.PI * 0.5;
    else if (this.y > 1.0 - margin) this.targetAngle = -Math.PI * 0.5;

    let diff = this.targetAngle - this.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.angle += diff * 0.025 * dt;

    const forwardX = Math.cos(this.angle);
    const forwardY = Math.sin(this.angle);
    this.x += forwardX * this.speed * dt;
    this.y += forwardY * this.speed * dt;

    this.segs[0].x = this.x;
    this.segs[0].y = this.y;

    for (let i = 1; i < this.numSegs; i++) {
      const prev = this.segs[i - 1];
      const curr = this.segs[i];
      let dx = curr.x - prev.x;
      let dy = curr.y - prev.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1e-5) { dx = 1e-4; dist = 1e-4; }

      const targetDist = this.spacing;
      curr.x = prev.x + (dx / dist) * targetDist;
      curr.y = prev.y + (dy / dist) * targetDist;

      const waveAmp = (i / this.numSegs) * 0.009;
      const lateralX = -forwardY * Math.sin(this.tailPhase - i * 0.45) * waveAmp;
      const lateralY = forwardX * Math.sin(this.tailPhase - i * 0.45) * waveAmp;
      curr.x += lateralX * 0.35;
      curr.y += lateralY * 0.35;
    }
  }

  get segmentData() {
    const arr = new Float32Array(this.numSegs * 3);
    for (let i = 0; i < this.numSegs; i++) {
      arr[i * 3 + 0] = this.segs[i].x;
      arr[i * 3 + 1] = this.segs[i].y;
      arr[i * 3 + 2] = this.segs[i].r;
    }
    return arr;
  }

  get headWake() {
    const fwdX = Math.cos(this.angle);
    const fwdY = Math.sin(this.angle);
    return {
      x: this.x,
      y: this.y,
      vx: fwdX * 0.045,
      vy: fwdY * 0.045,
      radius: 0.007
    };
  }

  get tailWake() {
    const tail = this.segs[this.numSegs - 1];
    const prev = this.segs[this.numSegs - 2];
    const dx = tail.x - prev.x;
    const dy = tail.y - prev.y;
    const wag = Math.sin(this.tailPhase);
    return {
      x: tail.x,
      y: tail.y,
      vx: -dy * wag * 0.08,
      vy: dx * wag * 0.08,
      radius: 0.009
    };
  }
}

export class ArcticMedusa {
  constructor() {
    this.x = 0.65;
    this.y = 0.60;
    this.radius = 0.045;
    this.depth = 0.40;
    this.pulsePhase = 0;
    this.pulseFreq = 1.35;
    this.numTentacleNodes = 16;
    this.tentacles = [];

    for (let i = 0; i < this.numTentacleNodes; i++) {
      this.tentacles.push({
        x: this.x + (Math.random() - 0.5) * 0.02,
        y: this.y - 0.02 - i * 0.015,
        opacity: 1.0 - (i / this.numTentacleNodes) * 0.6
      });
    }
  }

  update(dt, scrollProgress) {
    const step = dt * 0.016;
    this.pulsePhase += step * this.pulseFreq;

    this.x += Math.sin(this.pulsePhase * 0.5) * 0.00015 * dt;
    this.y += (Math.cos(this.pulsePhase) * 0.00035 + 0.00012) * dt;

    if (this.y > 1.15) this.y = -0.15;
    if (this.x < 0.1) this.x = 0.9;
    if (this.x > 0.9) this.x = 0.1;

    this.tentacles[0].x = this.x;
    this.tentacles[0].y = this.y - this.radius * 0.7;

    for (let i = 1; i < this.numTentacleNodes; i++) {
      const prev = this.tentacles[i - 1];
      const curr = this.tentacles[i];

      const targetY = prev.y - 0.012;
      const targetX = prev.x + Math.sin(this.pulsePhase - i * 0.4) * 0.0025;

      curr.x += (targetX - curr.x) * 0.22 * dt;
      curr.y += (targetY - curr.y) * 0.22 * dt;
    }
  }

  get tentacleData() {
    const arr = new Float32Array(this.numTentacleNodes * 3);
    for (let i = 0; i < this.numTentacleNodes; i++) {
      arr[i * 3 + 0] = this.tentacles[i].x;
      arr[i * 3 + 1] = this.tentacles[i].y;
      arr[i * 3 + 2] = this.tentacles[i].opacity;
    }
    return arr;
  }

  get wake() {
    const isContraction = Math.sin(this.pulsePhase) > 0.75;
    return {
      active: isContraction,
      x: this.x,
      y: this.y,
      vx: 0.0,
      vy: -0.045,
      radius: 0.006
    };
  }
}

export class ArcticNarwhal {
  constructor() {
    this.x = 0.85;
    this.y = 0.22;
    this.angle = -2.4;
    this.speed = 0.00042;
    this.length = 0.085;
    this.width = 0.026;
    this.tuskLength = 0.055;
    this.tailPhase = 0;
    this.depth = 0.45;
  }

  update(dt, scrollProgress) {
    const step = dt * 0.016;
    this.tailPhase += step * 1.5;

    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;

    if (this.x < -0.2) { this.x = 1.2; this.y = 0.2 + Math.random() * 0.6; }
    if (this.y < -0.2) { this.y = 1.2; this.x = 0.2 + Math.random() * 0.6; }
  }

  get wake() {
    return {
      x: this.x,
      y: this.y,
      vx: Math.cos(this.angle) * 0.038,
      vy: Math.sin(this.angle) * 0.038,
      radius: 0.006
    };
  }
}

export class CreatureSystem {
  constructor() {
    this.shark = new GreenlandShark();
    this.jelly = new ArcticMedusa();
    this.narwhal = new ArcticNarwhal();
  }

  applyScrollForce(delta) {
    const nudge = delta * 0.00002;
    this.shark.depth = Math.max(0.1, Math.min(0.85, this.shark.depth + nudge));
    this.shark.targetAngle += nudge * 0.5;
  }

  update(dt, scrollProgress) {
    this.shark.update(dt, scrollProgress);
    this.jelly.update(dt, scrollProgress);
    this.narwhal.update(dt, scrollProgress);
  }

  get wakes() {
    const list = [this.shark.headWake, this.shark.tailWake, this.narwhal.wake];
    const jw = this.jelly.wake;
    if (jw.active) list.push(jw);
    return list;
  }
}
