import * as S from './shaders.js';

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error('[BW shader]', gl.getShaderInfoLog(sh));
    return null;
  }
  return sh;
}

function linkProgram(gl, vertSrc, fragSrc) {
  const v = compileShader(gl, gl.VERTEX_SHADER,   vertSrc);
  const f = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!v || !f) return null;
  const p = gl.createProgram();
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.bindAttribLocation(p, 0, 'a_pos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error('[BW link]', gl.getProgramInfoLog(p));
  }
  gl.deleteShader(v);
  gl.deleteShader(f);
  return p;
}

class GLProg {
  constructor(gl, prog) { this.gl = gl; this.p = prog; this._u = {}; }
  use()         { this.gl.useProgram(this.p); }
  loc(n)        { return (this._u[n] ??= this.gl.getUniformLocation(this.p, n)); }
  u1f(n, v)     { this.gl.uniform1f(this.loc(n), v); }
  u1i(n, v)     { this.gl.uniform1i(this.loc(n), v); }
  u2f(n, x, y)  { this.gl.uniform2f(this.loc(n), x, y); }
  u3f(n,x,y,z)  { this.gl.uniform3f(this.loc(n), x, y, z); }
  tex(n, unit, t) {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, t);
    this.gl.uniform1i(this.loc(n), unit);
  }
}

function makeFBO(gl, w, h, iFmt, fmt, type, filter) {
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,     gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,     gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, iFmt, w, h, 0, fmt, type, null);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  return { tex, fbo };
}

function makeDoubleFBO(gl, w, h, iFmt, fmt, type, filter) {
  let A = makeFBO(gl, w, h, iFmt, fmt, type, filter);
  let B = makeFBO(gl, w, h, iFmt, fmt, type, filter);
  return {
    get readTex() { return A.tex; },
    get writeFBO(){ return B.fbo; },
    swap() { [A, B] = [B, A]; }
  };
}

export class FluidSimulation {
  constructor(gl, quadVAO, simW = 256, simH = 256) {
    this.gl      = gl;
    this.quadVAO = quadVAO;
    this.W       = simW;
    this.H       = simH;
    this.aspect  = 1.0;

    gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');

    this._buildProgs();
    this._buildFBOs();
    this._seed();
  }

  _buildProgs() {
    const mk = (frag) => new GLProg(this.gl, linkProgram(this.gl, S.VERT, frag));
    this.advectProg    = mk(S.FRAG_ADVECT);
    this.divProg       = mk(S.FRAG_DIV);
    this.pressureProg  = mk(S.FRAG_PRESSURE);
    this.gradSubProg   = mk(S.FRAG_GRAD_SUB);
    this.curlProg      = mk(S.FRAG_CURL);
    this.vorticityProg = mk(S.FRAG_VORTICITY);
    this.splatProg     = mk(S.FRAG_SPLAT);
  }

  _buildFBOs() {
    const { gl, W, H } = this;
    const HF = gl.HALF_FLOAT;
    const LIN = gl.LINEAR;
    const NEA = gl.NEAREST;

    this.velocity   = makeDoubleFBO(gl, W, H, gl.RG16F,   gl.RG,   HF, LIN);
    this.dye        = makeDoubleFBO(gl, W, H, gl.RGBA16F,  gl.RGBA, HF, LIN);
    this.pressure   = makeDoubleFBO(gl, W, H, gl.R16F,    gl.RED,   HF, NEA);
    this.divergence = makeFBO      (gl, W, H, gl.R16F,    gl.RED,   HF, NEA);
    this.curl       = makeFBO      (gl, W, H, gl.R16F,    gl.RED,   HF, NEA);
  }

  _seed() {
    const seeds = [
      [0.22, 0.30,  0.8,  0.4],
      [0.75, 0.25, -0.6,  0.7],
      [0.50, 0.68,  0.5, -0.8],
      [0.30, 0.72, -0.7, -0.5],
      [0.65, 0.55,  0.9, -0.3],
      [0.40, 0.20, -0.4,  0.9],
    ];
    seeds.forEach(([x, y, vx, vy]) => {
      const s = 0.180;
      this._splat(x, y, vx * s, vy * s, 0.005, false);
      this._splatDye(x, y, 0.055, 0.006);
    });
  }

  _blit(fbo) {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fbo);
    this.gl.viewport(0, 0, this.W, this.H);
    this.gl.bindVertexArray(this.quadVAO);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    this.gl.bindVertexArray(null);
  }

  _splat(x, y, vx, vy, radius, injectDye = true) {
    const p = this.splatProg;
    p.use();
    p.tex ('u_target', 0, this.velocity.readTex);
    p.u2f ('u_point',  x, y);
    p.u3f ('u_value',  vx, vy, 0);
    p.u1f ('u_radius', radius);
    p.u1f ('u_aspect', this.aspect);
    this._blit(this.velocity.writeFBO);
    this.velocity.swap();

    if (injectDye) this._splatDye(x, y, 0.035, radius * 1.2);
  }

  _splatDye(x, y, brightness, radius) {
    const p = this.splatProg;
    p.use();
    p.tex ('u_target', 0, this.dye.readTex);
    p.u2f ('u_point',  x, y);
    p.u3f ('u_value',  brightness * 0.45, brightness * 0.55, brightness);
    p.u1f ('u_radius', radius);
    p.u1f ('u_aspect', this.aspect);
    this._blit(this.dye.writeFBO);
    this.dye.swap();
  }

  setAspect(a) { this.aspect = a; }

  injectScrollForce(delta) {
    if (Math.abs(delta) < 0.1) return;
    const vy  = Math.sign(delta) * Math.min(Math.abs(delta) * 0.006, 0.30);
    const str = Math.abs(vy);
    [0.30, 0.50, 0.70].forEach(x => {
      const jitter = (Math.random() - 0.5) * str * 0.40;
      this._splat(x, 0.5, jitter, vy, 0.005, Math.abs(delta) > 8);
    });
  }

  injectVortex() {
    const x  = 0.15 + Math.random() * 0.70;
    const y  = 0.15 + Math.random() * 0.70;
    const a  = Math.random() * Math.PI * 2;
    const s  = 0.080 + Math.random() * 0.100;
    this._splat(x,        y,        Math.cos(a) * s,         Math.sin(a) * s,         0.005);
    this._splat(x + 0.10, y + 0.08, -Math.cos(a) * s * 0.65, -Math.sin(a) * s * 0.65, 0.004, false);
  }

  injectCreatureWake(x, y, vx, vy, radius = 0.005) {
    this._splat(x, y, vx, vy, radius, false);
  }

  injectMouseForce(x, y, vx, vy) {
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed < 1e-4) return;
    this._splat(x, y, vx * 0.8, vy * 0.8, 0.007, speed > 0.015);
  }

  // GPU Navier-Stokes solver using Jacobi pressure-projection with unconditionally stable semi-Lagrangian advection.
  step(dt) {
    const { gl, W, H, aspect } = this;
    const ts = [1 / W, 1 / H];

    {
      const p = this.advectProg;
      p.use();
      p.tex('u_velocity', 0, this.velocity.readTex);
      p.tex('u_source',   1, this.velocity.readTex);
      p.u1f('u_dt', 1.0);
      p.u1f('u_dissipation', 0.990);
      this._blit(this.velocity.writeFBO);
      this.velocity.swap();
    }

    {
      const p = this.curlProg;
      p.use();
      p.tex('u_velocity',  0, this.velocity.readTex);
      p.u2f('u_texelSize', ts[0], ts[1]);
      this._blit(this.curl.fbo);
    }

    {
      const p = this.vorticityProg;
      p.use();
      p.tex('u_velocity',     0, this.velocity.readTex);
      p.tex('u_curl',         1, this.curl.tex);
      p.u2f('u_texelSize',    ts[0], ts[1]);
      p.u1f('u_curl_strength', 3.0);
      p.u1f('u_dt', 1.0);
      this._blit(this.velocity.writeFBO);
      this.velocity.swap();
    }

    {
      const p = this.divProg;
      p.use();
      p.tex('u_velocity',  0, this.velocity.readTex);
      p.u2f('u_texelSize', ts[0], ts[1]);
      this._blit(this.divergence.fbo);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pressure.writeFBO);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.pressure.swap();

    for (let i = 0; i < 20; i++) {
      const p = this.pressureProg;
      p.use();
      p.tex('u_pressure',   0, this.pressure.readTex);
      p.tex('u_divergence', 1, this.divergence.tex);
      p.u2f('u_texelSize',  ts[0], ts[1]);
      this._blit(this.pressure.writeFBO);
      this.pressure.swap();
    }

    {
      const p = this.gradSubProg;
      p.use();
      p.tex('u_pressure',  0, this.pressure.readTex);
      p.tex('u_velocity',  1, this.velocity.readTex);
      p.u2f('u_texelSize', ts[0], ts[1]);
      this._blit(this.velocity.writeFBO);
      this.velocity.swap();
    }

    {
      const p = this.advectProg;
      p.use();
      p.tex('u_velocity',    0, this.velocity.readTex);
      p.tex('u_source',      1, this.dye.readTex);
      p.u1f('u_dt', 1.0);
      p.u1f('u_dissipation', 0.997);
      this._blit(this.dye.writeFBO);
      this.dye.swap();
    }
  }
}
