export const VERT = `#version 300 es
precision highp float;
in  vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv        = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

export const FRAG_ADVECT = `#version 300 es
precision highp float;
uniform sampler2D u_velocity;
uniform sampler2D u_source;
uniform float     u_dt;
uniform float     u_dissipation;
in  vec2 v_uv;
out vec4 o_color;
void main() {
  vec2 vel = texture(u_velocity, v_uv).xy;
  vec2 pos = clamp(v_uv - u_dt * vel, 0.0002, 0.9998);
  o_color  = u_dissipation * texture(u_source, pos);
}`;

export const FRAG_DIV = `#version 300 es
precision highp float;
uniform sampler2D u_velocity;
uniform vec2      u_texelSize;
in  vec2 v_uv;
out vec4 o_color;
void main() {
  vec2  t  = u_texelSize;
  float l  = texture(u_velocity, v_uv - vec2(t.x, 0.0)).x;
  float r  = texture(u_velocity, v_uv + vec2(t.x, 0.0)).x;
  float b  = texture(u_velocity, v_uv - vec2(0.0, t.y)).y;
  float tt = texture(u_velocity, v_uv + vec2(0.0, t.y)).y;
  o_color  = vec4(0.5 * (r - l + tt - b), 0.0, 0.0, 1.0);
}`;

export const FRAG_PRESSURE = `#version 300 es
precision highp float;
uniform sampler2D u_pressure;
uniform sampler2D u_divergence;
uniform vec2      u_texelSize;
in  vec2 v_uv;
out vec4 o_color;
void main() {
  vec2  t   = u_texelSize;
  float l   = texture(u_pressure,   v_uv - vec2(t.x, 0.0)).r;
  float r   = texture(u_pressure,   v_uv + vec2(t.x, 0.0)).r;
  float b   = texture(u_pressure,   v_uv - vec2(0.0, t.y)).r;
  float tt  = texture(u_pressure,   v_uv + vec2(0.0, t.y)).r;
  float div = texture(u_divergence, v_uv).r;
  o_color   = vec4((l + r + b + tt - div) * 0.25, 0.0, 0.0, 1.0);
}`;

export const FRAG_GRAD_SUB = `#version 300 es
precision highp float;
uniform sampler2D u_pressure;
uniform sampler2D u_velocity;
uniform vec2      u_texelSize;
in  vec2 v_uv;
out vec4 o_color;
void main() {
  vec2  t  = u_texelSize;
  float l  = texture(u_pressure, v_uv - vec2(t.x, 0.0)).r;
  float r  = texture(u_pressure, v_uv + vec2(t.x, 0.0)).r;
  float b  = texture(u_pressure, v_uv - vec2(0.0, t.y)).r;
  float tt = texture(u_pressure, v_uv + vec2(0.0, t.y)).r;
  vec2 vel = texture(u_velocity, v_uv).xy - 0.5 * vec2(r - l, tt - b);
  if (v_uv.x < t.x || v_uv.x > 1.0 - t.x) vel.x = 0.0;
  if (v_uv.y < t.y || v_uv.y > 1.0 - t.y) vel.y = 0.0;
  o_color = vec4(vel, 0.0, 1.0);
}`;

export const FRAG_CURL = `#version 300 es
precision highp float;
uniform sampler2D u_velocity;
uniform vec2      u_texelSize;
in  vec2 v_uv;
out vec4 o_color;
void main() {
  vec2  t  = u_texelSize;
  float l  = texture(u_velocity, v_uv - vec2(t.x, 0.0)).y;
  float r  = texture(u_velocity, v_uv + vec2(t.x, 0.0)).y;
  float b  = texture(u_velocity, v_uv - vec2(0.0, t.y)).x;
  float tt = texture(u_velocity, v_uv + vec2(0.0, t.y)).x;
  o_color  = vec4(0.5 * (r - l - tt + b), 0.0, 0.0, 1.0);
}`;

export const FRAG_VORTICITY = `#version 300 es
precision highp float;
uniform sampler2D u_velocity;
uniform sampler2D u_curl;
uniform vec2      u_texelSize;
uniform float     u_curl_strength;
uniform float     u_dt;
in  vec2 v_uv;
out vec4 o_color;
void main() {
  vec2  t  = u_texelSize;
  float l  = abs(texture(u_curl, v_uv - vec2(t.x, 0.0)).r);
  float r  = abs(texture(u_curl, v_uv + vec2(t.x, 0.0)).r);
  float b  = abs(texture(u_curl, v_uv - vec2(0.0, t.y)).r);
  float tt = abs(texture(u_curl, v_uv + vec2(0.0, t.y)).r);
  float c  = texture(u_curl, v_uv).r;
  vec2  f  = vec2(tt - b, -(r - l)) * 0.5;
  f        = (f / (length(f) + 1e-5)) * u_curl_strength * c;
  o_color  = vec4(texture(u_velocity, v_uv).xy + f * u_dt, 0.0, 1.0);
}`;

export const FRAG_SPLAT = `#version 300 es
precision highp float;
uniform sampler2D u_target;
uniform vec2      u_point;
uniform vec3      u_value;
uniform float     u_radius;
uniform float     u_aspect;
in  vec2 v_uv;
out vec4 o_color;
void main() {
  vec2  p  = (v_uv - u_point) * vec2(u_aspect, 1.0);
  float sp = exp(-dot(p, p) / u_radius);
  o_color  = texture(u_target, v_uv) + vec4(u_value * sp, 0.0);
}`;

export const FRAG_DISPLAY = `#version 300 es
precision highp float;

uniform sampler2D u_dye;
uniform sampler2D u_velocity;
uniform float     u_time;
uniform float     u_aspect;
uniform float     u_scrollProgress;
uniform vec4      u_mouse;

uniform vec4      u_shark;
uniform vec4      u_sharkFin;
uniform vec3      u_sharkSegs[14];

uniform vec4      u_jelly;
uniform vec4      u_jellyPulse;
uniform vec3      u_jellyTentacles[16];

uniform vec4      u_narwhal;
uniform vec4      u_narwhalParams;
uniform vec2      u_singularity;

in  vec2 v_uv;
out vec4 o_color;

const bool ENABLE_GLASS     = true;
const bool ENABLE_CREATURES = false;

float hash1(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 hash2(vec2 p) {
  float n = sin(dot(p, vec2(127.1, 311.7)));
  return fract(vec2(262144.0, 32768.0) * n);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash1(i);
  float b = hash1(i + vec2(1.0, 0.0));
  float c = hash1(i + vec2(0.0, 1.0));
  float d = hash1(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = rot * p * 2.05;
    a *= 0.48;
  }
  return v;
}

float iceCracks(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 n = vec2(float(x), float(y));
      vec2 pt = n + hash2(i + n) - f;
      float d = dot(pt, pt);
      if (d < d1) { d2 = d1; d1 = d; }
      else if (d < d2) { d2 = d; }
    }
  }
  return sqrt(d2) - sqrt(d1);
}

float waveHeight(vec2 p, float t, vec2 flow) {
  vec2 warp = vec2(
    sin(p.y * 0.70 + t * 0.08) * 0.14 + cos(p.x * 0.40 - t * 0.05) * 0.08,
    cos(p.x * 0.60 - t * 0.06) * 0.14 + sin(p.y * 0.50 + t * 0.07) * 0.08
  );
  p += warp;

  float h = 0.0;

  vec2 d1 = normalize(vec2(0.08, -0.99));
  vec2 p1_perp = vec2(-d1.y, d1.x);
  float ph1 = dot(p, d1) * 2.1 - t * 0.22;
  float crestEnv1 = cos(dot(p, p1_perp) * 0.65 + t * 0.04) * 0.35 + 0.65;
  float w1 = sin(ph1);
  h += (pow(w1 * 0.5 + 0.5, 2.2) * 2.0 - 1.0) * 0.22 * crestEnv1;
  p += d1 * cos(ph1) * 0.09 * crestEnv1;

  vec2 d2 = normalize(vec2(0.74, -0.67));
  vec2 p2_perp = vec2(-d2.y, d2.x);
  float ph2 = dot(p, d2) * 2.6 - t * 0.27 + w1 * 0.32;
  float crestEnv2 = cos(dot(p, p2_perp) * 0.75 - t * 0.05) * 0.30 + 0.70;
  float w2 = sin(ph2);
  h += (pow(w2 * 0.5 + 0.5, 1.9) * 2.0 - 1.0) * 0.16 * crestEnv2;
  p += d2 * cos(ph2) * 0.06 * crestEnv2;

  vec2 d3 = normalize(vec2(-0.68, -0.73));
  float ph3 = dot(p, d3) * 3.4 - t * 0.33 - w2 * 0.28;
  float w3 = sin(ph3);
  h += (pow(w3 * 0.5 + 0.5, 1.8) * 2.0 - 1.0) * 0.10;

  vec2 d4 = normalize(vec2(0.38, -0.92));
  float ph4 = dot(p, d4) * 1.3 - t * 0.14;
  float w4 = sin(ph4 + w3 * 0.25);
  h += w4 * 0.08;

  vec2 d5 = normalize(vec2(-0.85, 0.52));
  float ph5 = dot(p, d5) * 4.6 - t * 0.41 + w1 * 0.35;
  float w5 = sin(ph5);
  h += (pow(w5 * 0.5 + 0.5, 1.6) * 2.0 - 1.0) * 0.045;

  if (u_mouse.x > 0.0) {
    vec2 mPos = vec2((u_mouse.x - 0.5) * 3.8, (1.0 - u_mouse.y - 0.5) * 3.8 - 2.0);
    float mDist = length(p - mPos);
    float mDisp = sin(mDist * 6.5 - t * 2.0) * exp(-mDist * 1.8);
    float mSpeed = clamp(length(u_mouse.zw) * 35.0, 0.0, 1.0);
    h += mDisp * 0.14 * mSpeed;
  }

  return h;
}

vec3 calcWaterNormal3D(vec3 p, vec3 ro, float t, vec2 flow) {
  float dist = length(p - ro);
  float eps = 0.010 + dist * 0.005;
  float hC = waveHeight(p.xz, t, flow);
  float hX = waveHeight(p.xz + vec2(eps, 0.0), t, flow);
  float hZ = waveHeight(p.xz + vec2(0.0, eps), t, flow);

  vec3 N = normalize(vec3(hC - hX, eps, hC - hZ));
  return N;
}

const vec3 LIGHT_DIR = normalize(vec3(-0.25, 0.65, -0.72));

vec3 getSkyReflection(vec3 r) {
  float zenith = clamp(r.y, 0.0, 1.0);
  vec3 col = mix(vec3(0.005, 0.006, 0.008), vec3(0.016, 0.019, 0.023), pow(zenith, 0.8));

  float rDotL = max(0.0, dot(r, LIGHT_DIR));
  float broadSheen = pow(rDotL, 3.5) * 0.45;
  float ridgeSheen = pow(rDotL, 10.0) * 0.55;
  vec3 sheenColor  = vec3(0.088, 0.104, 0.118);
  col += sheenColor * (broadSheen + ridgeSheen);

  float horizon = pow(1.0 - abs(r.y), 3.0);
  col += vec3(0.008, 0.010, 0.012) * horizon;

  return col;
}

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / (dot(ba, ba) + 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

float sharkSDF(vec2 uv, out float outDorsalHighlight) {
  vec2 p = uv;
  vec2 head = u_shark.xy;
  float angle = u_shark.z;
  
  vec2 delta = (p - head) * vec2(u_aspect, 1.0);
  mat2 rot = mat2(cos(angle), sin(angle), -sin(angle), cos(angle));
  vec2 lp = rot * delta;

  float dBody = 1e5;
  
  for (int i = 0; i < 13; i++) {
    vec2 p1 = (u_sharkSegs[i].xy - head) * vec2(u_aspect, 1.0);
    vec2 p2 = (u_sharkSegs[i+1].xy - head) * vec2(u_aspect, 1.0);
    vec2 lp1 = rot * p1;
    vec2 lp2 = rot * p2;
    
    vec2 ba = lp2 - lp1;
    vec2 pa = lp - lp1;
    float t = clamp(dot(pa, ba) / (dot(ba, ba) + 1e-6), 0.0, 1.0);
    float r = mix(u_sharkSegs[i].z, u_sharkSegs[i+1].z, t);
    
    float dSeg = length(pa - ba * t) - r;
    dBody = min(dBody, dSeg);
  }

  float dSnout = length(lp - vec2(0.015, 0.0)) - u_sharkSegs[0].z * 0.92;
  dBody = min(dBody, dSnout);

  vec2 pPecL = lp - vec2(-0.065, 0.045);
  vec2 pPecR = lp - vec2(-0.065, -0.045);
  float dPecL = length(pPecL * vec2(1.8, 1.0)) - 0.042;
  float dPecR = length(pPecR * vec2(1.8, 1.0)) - 0.042;
  dBody = min(dBody, min(dPecL, dPecR));

  vec2 pTail = (u_sharkSegs[13].xy - head) * vec2(u_aspect, 1.0);
  vec2 lpTail = rot * pTail;
  vec2 tDelta = lp - lpTail;
  float dCaudalUpper = length((tDelta - vec2(-0.035,  0.038)) * vec2(1.5, 0.8)) - 0.032;
  float dCaudalLower = length((tDelta - vec2(-0.025, -0.024)) * vec2(1.6, 1.0)) - 0.024;
  dBody = min(dBody, min(dCaudalUpper, dCaudalLower));

  outDorsalHighlight = exp(-abs(lp.y) * 45.0) * smoothstep(-0.25, 0.02, lp.x);

  return dBody;
}

float jellySDF(vec2 uv, out float outGlow) {
  vec2 center = u_jelly.xy;
  float radius = u_jelly.z * (1.0 + u_jellyPulse.y * sin(u_jellyPulse.x));
  vec2 p = (uv - center) * vec2(u_aspect, 1.0);

  float dBell = length(p * vec2(1.0, 1.25)) - radius;
  float angle = atan(p.y, p.x);
  float scallops = sin(angle * 8.0) * 0.004;
  dBell += scallops;

  float distToCenter = length(p);
  outGlow = exp(-distToCenter / (radius * 0.65 + 1e-4)) * u_jellyPulse.z;

  float dTentacles = 1e5;
  for (int i = 0; i < 15; i++) {
    vec2 t1 = (u_jellyTentacles[i].xy - center) * vec2(u_aspect, 1.0);
    vec2 t2 = (u_jellyTentacles[i+1].xy - center) * vec2(u_aspect, 1.0);
    float dt = sdSegment(p, t1, t2) - 0.0035;
    dTentacles = min(dTentacles, dt);
  }

  return min(dBell, dTentacles);
}

float narwhalSDF(vec2 uv) {
  vec2 pos = u_narwhal.xy;
  float angle = u_narwhal.z;
  vec2 delta = (uv - pos) * vec2(u_aspect, 1.0);
  mat2 rot = mat2(cos(angle), sin(angle), -sin(angle), cos(angle));
  vec2 lp = rot * delta;

  float dBody = length(lp / vec2(u_narwhalParams.x, u_narwhalParams.y)) - 1.0;
  dBody *= min(u_narwhalParams.x, u_narwhalParams.y);

  vec2 tuskP = lp - vec2(u_narwhalParams.x * 0.95, 0.0);
  float dTusk = sdSegment(tuskP, vec2(0.0, 0.0), vec2(u_narwhalParams.z, 0.0)) - 0.003;

  vec2 tailP = lp - vec2(-u_narwhalParams.x * 0.95, 0.0);
  float dFluke = length((tailP - vec2(-0.02, 0.0)) * vec2(1.2, 0.5)) - 0.025;

  return min(min(dBody, dTusk), dFluke);
}

void main() {
  vec2 uv = v_uv;
  vec2 uvAspect = vec2(uv.x * u_aspect, uv.y);
  vec2 uvG = uv;

  vec2 flow = texture(u_velocity, uv).xy;
  float flowSpeed = length(flow);

  vec2 pScreen = (uv - 0.5) * vec2(u_aspect, 1.0);

  vec3 ro = vec3(0.0, 2.1, 0.8);
  vec3 ta = vec3(0.0, -0.25, -2.2);

  vec3 ww = normalize(ta - ro);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3 vv = cross(uu, ww);

  vec3 rd = normalize(pScreen.x * uu + pScreen.y * vv + 1.18 * ww);

  float t = (0.0 - ro.y) / rd.y;
  vec3 p = ro + rd * t;

  for (int i = 0; i < 5; i++) {
    float h = waveHeight(p.xz, u_time, flow);
    float err = p.y - h;
    float dt = (err / max(-rd.y, 0.15)) * 0.55;
    p += rd * clamp(dt, -0.25, 0.25);
  }

  vec3 N = calcWaterNormal3D(p, ro, u_time, flow);

  vec3 R = reflect(rd, N);
  vec3 skyReflect = getSkyReflection(R);

  float NdotV = max(0.0, dot(-rd, N));
  float fresnel = 0.06 + 0.94 * pow(1.0 - NdotV, 3.5);

  vec3 deepTrough = vec3(0.004, 0.006, 0.008);
  vec3 carbonBody = vec3(0.0155, 0.0195, 0.0255);
  vec3 liquidBody = mix(deepTrough, carbonBody, clamp(N.y * 0.75, 0.0, 1.0));

  vec3 waterColor = mix(liquidBody, skyReflect, fresnel);

  vec3 H = normalize(LIGHT_DIR - rd);
  float nDotH = max(0.0, dot(N, H));
  float viscousSheen1 = pow(nDotH, 12.0) * 0.85;
  float viscousSheen2 = pow(nDotH, 3.5)  * 0.45;
  vec3 crestColor = vec3(0.173, 0.194, 0.214);
  vec3 slopeColor = vec3(0.088, 0.104, 0.118);
  vec3 highlightColor = crestColor * viscousSheen1 + slopeColor * viscousSheen2;
  waterColor += highlightColor;

  if (ENABLE_CREATURES) {
    float sharkDorsalGlint = 0.0;
    float dShark = sharkSDF(uvG, sharkDorsalGlint);
    float mShark = 1.0 - smoothstep(-0.003, 0.006, dShark);
    if (mShark > 0.001) {
      float sharkDepth = u_shark.w;
      vec3 sharkSkin = vec3(0.020, 0.024, 0.030);
      sharkSkin += vec3(0.35, 0.42, 0.50) * sharkDorsalGlint * 0.75;
      sharkSkin += vec3(0.18, 0.25, 0.35) * pow(1.0 - smoothstep(0.0, 0.018, abs(dShark)), 3.0) * 0.5;
      float visibility = exp(-sharkDepth * 2.2);
      waterColor = mix(waterColor, sharkSkin * visibility, mShark * visibility);
    }

    float jellyGlow = 0.0;
    float dJelly = jellySDF(uvG, jellyGlow);
    float mJelly = 1.0 - smoothstep(-0.002, 0.005, dJelly);
    if (mJelly > 0.001 || jellyGlow > 0.001) {
      float jellyDepth = u_jelly.w;
      vec3 jellyBell = vec3(0.08, 0.16, 0.24);
      vec3 bioGlow = vec3(0.15, 0.65, 0.95) * jellyGlow * 1.8;
      vec3 jellyComposite = jellyBell * mJelly + bioGlow;
      float visibility = exp(-jellyDepth * 1.8);
      waterColor = mix(waterColor, waterColor + jellyComposite * visibility, clamp(mJelly + jellyGlow * 1.2, 0.0, 1.0) * visibility);
    }

    float dNarwhal = narwhalSDF(uvG);
    float mNarwhal = 1.0 - smoothstep(-0.003, 0.006, dNarwhal);
    if (mNarwhal > 0.001) {
      float narwhalDepth = u_narwhal.w;
      vec3 narwhalSkin = vec3(0.025, 0.032, 0.042);
      narwhalSkin += vec3(0.20, 0.26, 0.35) * 0.35;
      float visibility = exp(-narwhalDepth * 2.5);
      waterColor = mix(waterColor, narwhalSkin * visibility, mNarwhal * visibility);
    }
  }

  vec3 scene = waterColor;

  if (ENABLE_GLASS) {
    vec3 N_glass = vec3(0.0, 1.0, 0.0);
    float glassNdotV = max(0.0, dot(-rd, N_glass));
    float glassFresnel = 0.04 + 0.96 * pow(1.0 - glassNdotV, 3.8);

    vec3 glassReflect = reflect(rd, N_glass);
    vec3 glassSky = getSkyReflection(glassReflect);

    vec3 glassH = normalize(LIGHT_DIR - rd);
    float glassSpec = pow(max(0.0, dot(N_glass, glassH)), 16.0) * 0.22;
    vec3 glassHighlight = vec3(0.42, 0.44, 0.46) * glassSpec;

    scene += glassHighlight;
    scene = mix(scene, glassSky, glassFresnel * 0.15);

    float grazingRim = pow(1.0 - glassNdotV, 4.0) * 0.10;
    scene += vec3(0.12, 0.14, 0.16) * grazingRim;
  }

  float depthDarkening = clamp(1.0 - u_scrollProgress, 0.0, 1.0);
  scene *= depthDarkening;

  if (u_singularity.x > 0.5) {
    float prog = u_singularity.y;
    vec2 pCenter = (v_uv - vec2(0.5)) * vec2(u_aspect, 1.0);
    float d = length(pCenter);

    float coreRadius = 0.0018 + 0.0012 * prog;
    float core = 1.0 - smoothstep(0.0, coreRadius, d);

    float glowRadius = 0.035 + 0.28 * pow(prog, 1.3);
    float innerGlow = exp(-d / (0.008 + 0.025 * prog));
    float outerHalo = exp(-d / glowRadius);

    float pulse = 1.0 + 0.07 * sin(u_time * 8.0) + 0.04 * cos(u_time * 13.0);
    float spikeX = exp(-abs(pCenter.x) * 160.0) * exp(-abs(pCenter.y) * 16.0);
    float spikeY = exp(-abs(pCenter.y) * 160.0) * exp(-abs(pCenter.x) * 16.0);
    float spikes = (spikeX + spikeY) * (0.15 + 0.85 * prog);

    float baseLum = 0.35 + 0.65 * prog;
    vec3 coreCol = vec3(1.0, 1.0, 1.0) * (core * 1.5 + innerGlow * 0.9) * baseLum;
    vec3 haloCol = vec3(0.55, 0.75, 1.00) * outerHalo * (0.10 + 0.70 * pow(prog, 1.5)) * pulse;
    vec3 spikeCol = vec3(0.85, 0.92, 1.00) * spikes * (0.08 + 0.45 * prog) * pulse;

    vec3 singularity = (coreCol + haloCol + spikeCol) * pulse;
    scene += singularity;
  }

  vec2 vc = uv * 2.0 - 1.0;
  float vig = pow(clamp(1.0 - dot(vc, vc) * 0.38, 0.0, 1.0), 1.10);
  scene *= vig;

  o_color = vec4(clamp(scene, 0.0, 1.0), 1.0);
}
`;
