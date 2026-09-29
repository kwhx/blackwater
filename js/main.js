import { FluidSimulation } from './fluid.js';
import { CreatureSystem   } from './creatures.js';
import * as S               from './shaders.js';

const canvas = document.getElementById('bw-canvas');
const gl     = canvas.getContext('webgl2', {
  antialias:       false,
  alpha:           false,
  depth:           false,
  stencil:         false,
  powerPreference: 'high-performance'
});

if (!gl) {
  document.body.style.background = '#030305';
  throw new Error('[Blackwater] WebGL2 not supported in this browser.');
}

gl.disable(gl.BLEND);
gl.disable(gl.DEPTH_TEST);
gl.disable(gl.STENCIL_TEST);

const quadVAO = gl.createVertexArray();
gl.bindVertexArray(quadVAO);
{
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER,
    new Float32Array([-1, -1,  1, -1,  -1, 1,  1, 1]),
    gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
}
gl.bindVertexArray(null);

const pixelCount = window.innerWidth * window.innerHeight;
const SIM_RES    = pixelCount > 1_500_000 ? 256 : 128;

const fluid     = new FluidSimulation(gl, quadVAO, SIM_RES, SIM_RES);
const creatures = new CreatureSystem();

function compileShader(type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error('[Blackwater display shader]', gl.getShaderInfoLog(sh));
  }
  return sh;
}

const vertSh = compileShader(gl.VERTEX_SHADER,   S.VERT);
const fragSh = compileShader(gl.FRAGMENT_SHADER, S.FRAG_DISPLAY);
const dispProg = gl.createProgram();
gl.attachShader(dispProg, vertSh);
gl.attachShader(dispProg, fragSh);
gl.bindAttribLocation(dispProg, 0, 'a_pos');
gl.linkProgram(dispProg);
if (!gl.getProgramParameter(dispProg, gl.LINK_STATUS)) {
  console.error('[Blackwater display link]', gl.getProgramInfoLog(dispProg));
}
gl.deleteShader(vertSh);
gl.deleteShader(fragSh);

const DU = {};
[
  'u_dye', 'u_velocity',
  'u_time', 'u_aspect', 'u_scrollProgress',
  'u_mouse',
  'u_shark', 'u_sharkFin', 'u_sharkSegs[0]',
  'u_jelly', 'u_jellyPulse', 'u_jellyTentacles[0]',
  'u_narwhal', 'u_narwhalParams',
  'u_singularity'
].forEach(n => {
  DU[n] = gl.getUniformLocation(dispProg, n) || gl.getUniformLocation(dispProg, n.replace('[0]', ''));
});

let viewW       = 0;
let viewH       = 0;
let scrollY     = window.scrollY;
let scrollDelta = 0;
let time        = 0;
let lastTS      = 0;
let vortexTimer = 0;

const mouse = {
  x: -1.0,
  y: -1.0,
  vx: 0.0,
  vy: 0.0,
  lastX: -1.0,
  lastY: -1.0,
  isActive: false
};

window.addEventListener('pointermove', (e) => {
  const normX = e.clientX / window.innerWidth;
  const normY = 1.0 - (e.clientY / window.innerHeight);

  if (mouse.lastX >= 0.0) {
    mouse.vx = normX - mouse.lastX;
    mouse.vy = normY - mouse.lastY;
    fluid.injectMouseForce(normX, normY, mouse.vx, mouse.vy);
  }

  mouse.x = normX;
  mouse.y = normY;
  mouse.lastX = normX;
  mouse.lastY = normY;
  mouse.isActive = true;
}, { passive: true });

window.addEventListener('pointerleave', () => {
  mouse.x = -1.0;
  mouse.y = -1.0;
  mouse.lastX = -1.0;
  mouse.lastY = -1.0;
  mouse.vx = 0.0;
  mouse.vy = 0.0;
  mouse.isActive = false;
});

function resize() {
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width  = Math.round(viewW * dpr);
  canvas.height = Math.round(viewH * dpr);
  fluid.setAspect(viewW / viewH);
}

window.addEventListener('resize', resize, { passive: true });
resize();

window.addEventListener('scroll', () => {
  const newY   = window.scrollY;
  const delta  = newY - scrollY;
  scrollY      = newY;
  scrollDelta += delta;
}, { passive: true });

function frame(ts) {
  requestAnimationFrame(frame);

  const rawDt = Math.min(ts - lastTS, 66.7) / 1000;
  lastTS      = ts;
  time       += rawDt;

  const dt = rawDt * 60;

  mouse.vx *= 0.88;
  mouse.vy *= 0.88;

  vortexTimer -= rawDt;
  if (vortexTimer <= 0) {
    fluid.injectVortex();
    vortexTimer = 1.8 + Math.random() * 2.0;
  }

  if (Math.abs(scrollDelta) > 0.5) {
    fluid.injectScrollForce(scrollDelta);
    creatures.applyScrollForce(scrollDelta);
  }
  scrollDelta = 0;

  const waterMaxScroll = 25 * viewH;
  const waterProgress = Math.max(0.0, Math.min(1.0, scrollY / waterMaxScroll));
  const singularityActive = scrollY >= waterMaxScroll ? 1.0 : 0.0;
  const singularityProgress = Math.max(0.0, Math.min(1.0, (scrollY - waterMaxScroll) / viewH));

  fluid.step(dt);

  creatures.update(dt, waterProgress);
  creatures.wakes.forEach(w => {
    fluid.injectCreatureWake(w.x, w.y, w.vx, w.vy, w.radius || 0.005);
  });

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.useProgram(dispProg);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, fluid.dye.readTex);
  gl.uniform1i(DU['u_dye'], 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, fluid.velocity.readTex);
  gl.uniform1i(DU['u_velocity'], 1);

  gl.uniform1f(DU['u_time'], time);
  gl.uniform1f(DU['u_aspect'], viewW / viewH);
  gl.uniform1f(DU['u_scrollProgress'], waterProgress);
  gl.uniform2f(DU['u_singularity'], singularityActive, singularityProgress);
  gl.uniform4f(DU['u_mouse'], mouse.x, mouse.y, mouse.vx, mouse.vy);

  const shark = creatures.shark;
  gl.uniform4f(DU['u_shark'], shark.x, shark.y, shark.angle, shark.depth);
  gl.uniform4f(DU['u_sharkFin'], shark.tailPhase, shark.tailFreq, shark.spacing, 0.0);
  gl.uniform3fv(DU['u_sharkSegs[0]'], shark.segmentData);

  const jelly = creatures.jelly;
  gl.uniform4f(DU['u_jelly'], jelly.x, jelly.y, jelly.radius, jelly.depth);
  gl.uniform4f(DU['u_jellyPulse'], jelly.pulsePhase, 0.16, 1.2, 0.0);
  gl.uniform3fv(DU['u_jellyTentacles[0]'], jelly.tentacleData);

  const narwhal = creatures.narwhal;
  gl.uniform4f(DU['u_narwhal'], narwhal.x, narwhal.y, narwhal.angle, narwhal.depth);
  gl.uniform4f(DU['u_narwhalParams'], narwhal.length, narwhal.width, narwhal.tuskLength, narwhal.tailPhase);

  gl.bindVertexArray(quadVAO);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.bindVertexArray(null);
}

requestAnimationFrame(frame);
