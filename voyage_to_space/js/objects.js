import * as THREE from 'three';
import { NOISE, BLACKBODY, RSI, LOGV_PARS, LOGV, LOGF_PARS, LOGF } from './shaders.js';

export const shared = {
  pxScale: { value: 800 },
  time: { value: 0 },
};

// ---------- utilities ----------
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

export function bbColor(T) {
  // JS blackbody approximation (normalized)
  const lam = [0.61, 0.549, 0.468];
  const b = lam.map(l => 1 / (Math.pow(l, 5) * (Math.exp(Math.min(14388 / (l * T), 80)) - 1)));
  const m = Math.max(...b);
  return new THREE.Color(b[0] / m, b[1] / m, b[2] / m);
}

// 3D tileable value-noise fbm texture
let _noise3D = null;
export function noise3D() {
  if (_noise3D) return _noise3D;
  const N = 64, P = 16;
  const r = rng(7);
  const lat = new Float32Array(P * P * P).map(() => r());
  const L = (x, y, z) => lat[((x % P + P) % P) + ((y % P + P) % P) * P + ((z % P + P) % P) * P * P];
  const sm = t => t * t * (3 - 2 * t);
  function vnoise(x, y, z, period) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
    const g = (a, b, c) => L(((xi + a) % period) + 0, ((yi + b) % period), ((zi + c) % period));
    const x00 = g(0, 0, 0) + (g(1, 0, 0) - g(0, 0, 0)) * xf, x10 = g(0, 1, 0) + (g(1, 1, 0) - g(0, 1, 0)) * xf;
    const x01 = g(0, 0, 1) + (g(1, 0, 1) - g(0, 0, 1)) * xf, x11 = g(0, 1, 1) + (g(1, 1, 1) - g(0, 1, 1)) * xf;
    const y0 = x00 + (x10 - x00) * yf, y1 = x01 + (x11 - x01) * yf;
    return y0 + (y1 - y0) * zf;
  }
  const data = new Uint8Array(N * N * N);
  let i = 0;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let f = 0, a = 0.5, fr = 4 / N;
    let per = 4;
    for (let o = 0; o < 4; o++) {
      f += a * vnoise(x * fr * Math.pow(2, o), y * fr * Math.pow(2, o), z * fr * Math.pow(2, o), Math.min(per * Math.pow(2, o), P));
      a *= 0.5;
    }
    data[i++] = Math.max(0, Math.min(255, (f / 0.9375) * 255));
  }
  const tex = new THREE.Data3DTexture(data, N, N, N);
  tex.format = THREE.RedFormat; tex.type = THREE.UnsignedByteType;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping;
  tex.unpackAlignment = 1; tex.needsUpdate = true;
  _noise3D = tex;
  return tex;
}

// ---------- Starfield with relativistic aberration + Doppler ----------
export function makeStarfield(count = 26000) {
  const r = rng(42);
  const pos = new Float32Array(count * 3), mag = new Float32Array(count), temp = new Float32Array(count);
  const planeN = new THREE.Vector3(0.2, 1, 0.35).normalize();
  const tmp = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  a.set(1, 0, 0).cross(planeN).normalize(); b.copy(planeN).cross(a).normalize();
  for (let i = 0; i < count; i++) {
    if (r() < 0.45) {
      const th = r() * Math.PI * 2, lat = gauss(r) * 0.18;
      tmp.copy(a).multiplyScalar(Math.cos(th) * Math.cos(lat)).addScaledVector(b, Math.sin(th) * Math.cos(lat)).addScaledVector(planeN, Math.sin(lat));
    } else {
      const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      tmp.set(s * Math.cos(th), u, s * Math.sin(th));
    }
    pos.set([tmp.x, tmp.y, tmp.z], i * 3);
    mag[i] = 8.0 + 2.0 * Math.log10(Math.max(r(), 1e-6)); // N(<m) ∝ 10^(0.5m)
    const k = r();
    temp[i] = k < 0.55 ? 3000 + r() * 2200 : k < 0.85 ? 5200 + r() * 2000 : k < 0.97 ? 7200 + r() * 4000 : 11000 + r() * 18000;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('mag', new THREE.BufferAttribute(mag, 1));
  g.setAttribute('temp', new THREE.BufferAttribute(temp, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { beta: { value: 0 }, velDir: { value: new THREE.Vector3(0, 0, -1) }, opacity: { value: 1 }, pxRatio: { value: 1 } },
    vertexShader: LOGV_PARS + BLACKBODY + `
      attribute float mag; attribute float temp;
      uniform float beta; uniform vec3 velDir; uniform float pxRatio; uniform float opacity;
      varying vec3 vCol; varying float vA;
      void main(){
        vec3 d=normalize(position);
        float c=dot(d,velDir);
        vec3 perp=d-velDir*c; float pl=length(perp); perp = pl>1e-6? perp/pl : vec3(0.0);
        float c2=(c+beta)/(1.0+beta*c);
        float s2=sqrt(max(0.0,1.0-c2*c2));
        vec3 d2=velDir*c2+perp*s2;
        float gam=1.0/sqrt(max(1e-4,1.0-beta*beta));
        float D=1.0/(gam*(1.0-beta*c2));
        float flux=pow(10.0,-0.4*(mag-1.0))*pow(D,3.0);
        vCol=blackbody(temp*D);
        float s=clamp(1.2+sqrt(flux)*3.5,1.0,9.0);
        vA=clamp(flux*1.6,0.0,6.0)*opacity;
        if(s<1.6){ vA*=0.9; }
        gl_PointSize=s*pxRatio;
        vec4 wp=vec4(cameraPosition+d2*9.0e6,1.0);
        gl_Position=projectionMatrix*viewMatrix*wp;
        ${LOGV}
      }`,
    fragmentShader: LOGF_PARS + `
      varying vec3 vCol; varying float vA;
      void main(){ ${LOGF}
        vec2 c=gl_PointCoord-0.5; float r=dot(c,c)*4.0; if(r>1.0) discard;
        float a=exp(-r*5.0);
        gl_FragColor=vec4(vCol*a*vA,1.0);
      }`,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, transparent: true,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false; pts.renderOrder = -5;
  return pts;
}

export function makeSkySphere(tex, brightness = 0.35) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, bright: { value: brightness } },
    vertexShader: LOGV_PARS + `varying vec3 vD; void main(){ vD=position; vec4 wp=vec4(cameraPosition+position*8.0e6,1.0); gl_Position=projectionMatrix*viewMatrix*wp; ${LOGV} }`,
    fragmentShader: LOGF_PARS + `uniform sampler2D map; uniform float bright; varying vec3 vD;
      void main(){ ${LOGF} vec3 d=normalize(vD); vec2 uv=vec2(atan(d.z,d.x)/6.2831853+0.5, asin(clamp(d.y,-1.0,1.0))/3.14159265+0.5);
        vec3 c=texture2D(map,uv).rgb; c=max(c-0.02,0.0); gl_FragColor=vec4(c*bright,1.0); }`,
    depthWrite: false, side: THREE.BackSide,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
  m.frustumCulled = false; m.renderOrder = -10;
  m.rotation.set(0.5, 0.2, 1.1);
  return m;
}

// ---------- Planets ----------
const PLANET_FRAG = LOGF_PARS + NOISE + `
  uniform sampler2D dayMap, nightMap, auxMap, ringMap;
  uniform float hasNight, hasAux, hasRing, ringProc;
  uniform vec3 sunPos, sunColor; uniform float sunI;
  uniform int procType; uniform vec3 c1,c2,c3; uniform float seed; uniform float time;
  uniform vec3 rimColor; uniform float rimStr;
  uniform vec3 center; uniform vec3 ringN; uniform float ringIn, ringOut; uniform float radius;
  uniform float ambient;
  varying vec2 vUv; varying vec3 vN, vP, vObjN, vLobj;
  vec3 procSurface(vec3 n, vec3 Ls, out float spec, out vec3 emis){
    vec3 p=n*2.0+vec3(seed);
    float h=fbm(p*1.5); spec=0.0; emis=vec3(0.0);
    if(procType==1||procType==7){
      float r=ridged(p*3.0);
      float t=clamp(h*0.8+0.5+r*0.25-0.12,0.0,1.0);
      vec3 col=mix(c1,c2,smoothstep(0.2,0.8,t));
      col=mix(col,c3,smoothstep(0.55,0.9,fbm3(p*6.0+3.0))*0.6);
      // crater-ish speckle
      float cr=smoothstep(0.55,0.7,snoise(p*14.0));
      col*=1.0-cr*0.25;
      if(procType==7){
        float heart=dot(n,normalize(vec3(0.55,0.05,0.83)));
        float hb=smoothstep(0.72,0.80,heart+0.08*fbm3(p*4.0));
        col=mix(col,vec3(0.93,0.88,0.80),hb);
      }
      return col;
    }
    if(procType==2){
      float sea=0.02;
      if(h<sea){ spec=1.0; return mix(c1*0.45,c1,smoothstep(-0.5,sea,h)); }
      vec3 land=mix(c2,c3,smoothstep(0.05,0.45,h+0.2*fbm3(p*5.0)));
      land=mix(land,vec3(0.92),smoothstep(0.78,0.86,abs(n.y)+h*0.2));
      return land;
    }
    if(procType==3){
      float sub=dot(n,Ls);
      float edge=smoothstep(0.30,0.50,sub+h*0.25);
      vec3 ice=mix(vec3(0.88,0.9,0.94),vec3(0.62,0.68,0.76),smoothstep(0.0,0.6,fbm3(p*4.0)));
      bool land=h>0.12;
      vec3 warm= land ? c2*(0.75+0.5*h) : mix(c1*0.45,c1,smoothstep(-0.5,0.12,h));
      spec= land?0.0:edge;
      return mix(ice,warm,edge);
    }
    if(procType==4){
      float r=ridged(p*4.0);
      vec3 col=mix(c1,c2,smoothstep(0.62,0.98,r));
      col=mix(col,c3,smoothstep(0.1,0.6,h)*0.55);
      return col;
    }
    if(procType==5){
      float r=ridged(p*3.5);
      float crack=smoothstep(0.80,0.97,r);
      emis=vec3(1.0,0.32,0.05)*crack*4.0*(0.6+0.4*snoise(p*2.0+time*0.15));
      return mix(c1,c2,smoothstep(-0.3,0.5,h))*(1.0-crack*0.9);
    }
    if(procType==6){
      float w=fbm3(vec3(n.x*2.0,n.y*5.0,n.z*2.0)+seed)*0.18;
      float b=sin((n.y+w)*24.0)*0.5+0.5;
      float b2=sin((n.y+w*1.6)*9.0)*0.5+0.5;
      return mix(mix(c1,c2,b),c3,b2*0.35)*(0.9+0.2*fbm3(p*3.0));
    }
    return c1;
  }
  vec2 rsi(vec3 ro, vec3 rd, float r){ float b=dot(ro,rd); float c=dot(ro,ro)-r*r; float d=b*b-c; if(d<0.0) return vec2(1e20,-1e20); d=sqrt(d); return vec2(-b-d,-b+d); }
  void main(){ ${LOGF}
    vec3 N=normalize(vN); vec3 L=normalize(sunPos-vP); vec3 V=normalize(cameraPosition-vP);
    float NdL=dot(N,L);
    vec3 albedo; float spec=0.0; vec3 emis=vec3(0.0); float rough=0.5;
    if(procType==0){ albedo=texture2D(dayMap,vUv).rgb; }
    else { albedo=procSurface(normalize(vObjN),normalize(vLobj),spec,emis); }
    if(hasAux>0.5){ vec3 ax=texture2D(auxMap,vUv).rgb; spec=smoothstep(0.55,0.35,ax.g); }
    float diff=clamp(NdL*1.05+0.03,0.0,1.0);
    vec3 col=albedo*(diff*sunColor*sunI+ambient);
    vec3 H=normalize(L+V);
    float fres=0.04+0.96*pow(1.0-max(dot(H,V),0.0),5.0);
    col+=sunColor*sunI*pow(max(dot(N,H),0.0),90.0)*spec*diff*2.2*(0.4+fres);
    if(hasNight>0.5){
      vec3 nl=texture2D(nightMap,vUv).rgb;
      col+=pow(nl,vec3(1.4))*vec3(1.0,0.75,0.45)*smoothstep(0.02,-0.18,NdL)*2.6;
    }
    if(hasRing>0.5){
      float dn=dot(L,ringN);
      if(abs(dn)>1e-4){
        float t=dot(center-vP,ringN)/dn;
        if(t>0.0){
          vec3 hp=vP+L*t; float rr=length(hp-center);
          float u=(rr-ringIn)/(ringOut-ringIn);
          if(u>0.0&&u<1.0){
            float a = ringProc>0.5 ? 0.6 : texture2D(ringMap,vec2(u,0.5)).a;
            col*=1.0-a*0.85;
          }
        }
      }
    }
    float rim=pow(1.0-max(dot(N,V),0.0),3.0);
    col+=rimColor*rim*rimStr*smoothstep(-0.35,0.6,NdL)*sunI;
    col+=emis;
    gl_FragColor=vec4(col,1.0);
  }`;
const PLANET_VERT = LOGV_PARS + `
  uniform vec3 sunPos; varying vec2 vUv; varying vec3 vN, vP, vObjN, vLobj;
  void main(){ vUv=uv; vObjN=normal; vN=normalize(mat3(modelMatrix)*normal);
    vec4 wp=modelMatrix*vec4(position,1.0); vP=wp.xyz;
    vLobj=normalize(transpose(mat3(modelMatrix))*normalize(sunPos-wp.xyz));
    gl_Position=projectionMatrix*viewMatrix*wp; ${LOGV} }`;

const ATMO_FRAG = LOGF_PARS + RSI + `
  uniform vec3 center; uniform float R, Ra; uniform vec3 sunPos, sunColor; uniform float sunI;
  uniform vec3 betaR; uniform float betaM, density, scaleH, gM;
  varying vec3 vP;
  void main(){ ${LOGF}
    vec3 ro=cameraPosition-center; vec3 rd=normalize(vP-cameraPosition);
    vec2 a=rsi(ro,rd,Ra); if(a.x>a.y) discard;
    vec2 p=rsi(ro,rd,R);
    float t0=max(a.x,0.0), t1=a.y; if(p.x>0.0) t1=min(t1,p.x);
    if(t1<=t0) discard;
    vec3 L=normalize(sunPos-center);
    const int S=14; float ds=(t1-t0)/float(S);
    vec3 sumR=vec3(0.0), sumM=vec3(0.0); float odR=0.0;
    float H=Ra-R;
    for(int i=0;i<S;i++){
      vec3 q=ro+rd*(t0+(float(i)+0.5)*ds);
      float h=(length(q)-R)/H;
      float d=exp(-h*scaleH)*density;
      odR+=d*ds/H;
      vec2 ls=rsi(q,L,R);
      if(ls.x>0.0 && ls.y>0.0) continue;
      vec2 la=rsi(q,L,Ra);
      float lLen=la.y/H;
      float hm=clamp(h+0.5*lLen*0.3,0.0,4.0);
      float odL=exp(-hm*scaleH)*density*lLen*0.6;
      vec3 att=exp(-(betaR*(odR+odL))-betaM*(odR+odL)*1.1);
      sumR+=d*att*ds/H; sumM+=d*att*ds/H;
    }
    float mu=dot(rd,L);
    float pR=0.0596831*(1.0+mu*mu);
    float g=gM; float pM=0.1193662*((1.0-g*g)*(1.0+mu*mu))/((2.0+g*g)*pow(max(1.0+g*g-2.0*g*mu,1e-4),1.5));
    vec3 col=(sumR*betaR*pR+sumM*betaM*pM)*sunColor*sunI*18.0;
    col*=mix(0.03,1.0,smoothstep(R*1.004,Ra*1.01,length(ro)));
    col=col/(1.0+col*0.35);
    gl_FragColor=vec4(col,1.0);
  }`;

export function makePlanet(o) {
  const R = o.radius;
  const grp = new THREE.Group();
  const body = new THREE.Group(); // spins
  grp.add(body);
  const seg = o.segments || 128;
  const u = {
    dayMap: { value: o.map || null }, nightMap: { value: o.night || null }, auxMap: { value: o.aux || null }, ringMap: { value: o.ring?.map || null },
    hasNight: { value: o.night ? 1 : 0 }, hasAux: { value: o.aux ? 1 : 0 }, hasRing: { value: o.ring && o.ring.shadow !== false ? 1 : 0 }, ringProc: { value: o.ring && !o.ring.map ? 1 : 0 },
    sunPos: { value: new THREE.Vector3() }, sunColor: { value: new THREE.Color(1, 1, 1) }, sunI: { value: o.sunI ?? 1.6 },
    procType: { value: o.map ? 0 : (o.proc?.type ?? 1) }, c1: { value: new THREE.Color(o.proc?.c1 || '#888') }, c2: { value: new THREE.Color(o.proc?.c2 || '#555') }, c3: { value: new THREE.Color(o.proc?.c3 || '#aaa') },
    seed: { value: o.proc?.seed ?? 1.3 }, time: shared.time,
    rimColor: { value: new THREE.Color(o.rim || '#000') }, rimStr: { value: o.rimStr ?? 0.0 },
    center: { value: new THREE.Vector3() }, ringN: { value: new THREE.Vector3(0, 1, 0) },
    ringIn: { value: o.ring ? o.ring.inner * R : 0 }, ringOut: { value: o.ring ? o.ring.outer * R : 0 }, radius: { value: R },
    ambient: { value: o.ambient ?? 0.004 },
  };
  const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG });
  const geo = new THREE.SphereGeometry(R, seg, seg / 2);
  const mesh = new THREE.Mesh(geo, mat);
  if (o.oblate) mesh.scale.y = 1 - o.oblate;
  body.add(mesh);
  grp.userData = { R, uniforms: u, body };

  let clouds = null;
  if (o.clouds) {
    const cu = { map: { value: o.clouds }, chan: { value: o.cloudChan ?? 2 }, sunPos: u.sunPos, sunColor: u.sunColor, sunI: u.sunI };
    const cm = new THREE.ShaderMaterial({
      uniforms: cu, transparent: true, depthWrite: false,
      vertexShader: LOGV_PARS + `varying vec2 vUv; varying vec3 vN,vP; void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); vec4 wp=modelMatrix*vec4(position,1.0); vP=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; ${LOGV} }`,
      fragmentShader: LOGF_PARS + `uniform sampler2D map; uniform int chan; uniform vec3 sunPos,sunColor; uniform float sunI; varying vec2 vUv; varying vec3 vN,vP;
        void main(){ ${LOGF} vec4 t=texture2D(map,vUv); float a= chan==2? t.b : t.r; a=smoothstep(0.08,0.9,a);
          vec3 L=normalize(sunPos-vP); float d=clamp(dot(normalize(vN),L)*1.1+0.05,0.0,1.0);
          vec3 c=vec3(1.0)*d*sunColor*sunI*0.95 + vec3(0.003);
          gl_FragColor=vec4(c,a*0.92); }`,
    });
    clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.006, seg, seg / 2), cm);
    body.add(clouds);
  }
  let atmo = null;
  if (o.atmo) {
    const A = o.atmo;
    const Ra = R * (1 + (A.thick ?? 0.025));
    const au = {
      center: { value: new THREE.Vector3() }, R: { value: R * 0.999 }, Ra: { value: Ra }, sunPos: u.sunPos, sunColor: u.sunColor, sunI: u.sunI,
      betaR: { value: new THREE.Vector3(...(A.betaR || [0.18, 0.42, 1.0])).multiplyScalar(A.k ?? 4) }, betaM: { value: A.mie ?? 0.6 }, density: { value: A.density ?? 1 }, scaleH: { value: A.scaleH ?? 4 }, gM: { value: A.g ?? 0.76 },
    };
    const am = new THREE.ShaderMaterial({
      uniforms: au, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
      vertexShader: LOGV_PARS + `varying vec3 vP; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vP=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; ${LOGV} }`,
      fragmentShader: ATMO_FRAG,
    });
    atmo = new THREE.Mesh(new THREE.SphereGeometry(Ra, 96, 48), am);
    atmo.userData.au = au;
    grp.add(atmo);
  }
  let ring = null;
  if (o.ring) {
    const ru = {
      map: { value: o.ring.map || null }, proc: { value: o.ring.map ? 0 : 1 }, inner: { value: o.ring.inner * R }, outer: { value: o.ring.outer * R },
      sunPos: u.sunPos, sunColor: u.sunColor, sunI: u.sunI, center: u.center, planetR: { value: R }, ringN: u.ringN, tint: { value: new THREE.Color(o.ring.tint || '#fff') },
    };
    const rm = new THREE.ShaderMaterial({
      uniforms: ru, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: LOGV_PARS + `varying vec2 vL; varying vec3 vP; void main(){ vL=position.xy; vec4 wp=modelMatrix*vec4(position,1.0); vP=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; ${LOGV} }`,
      fragmentShader: LOGF_PARS + RSI + `uniform sampler2D map; uniform float proc, inner, outer, planetR, sunI; uniform vec3 sunPos, sunColor, center, ringN, tint; varying vec2 vL; varying vec3 vP;
        void main(){ ${LOGF}
          float r=length(vL); float u=(r-inner)/(outer-inner); if(u<0.0||u>1.0) discard;
          vec4 t; if(proc>0.5){ float a=0.0; a+=smoothstep(0.012,0.0,abs(u-0.12)); a+=smoothstep(0.01,0.0,abs(u-0.3)); a+=smoothstep(0.014,0.0,abs(u-0.55)); a+=smoothstep(0.03,0.0,abs(u-0.93))*1.2; a+= 0.04; t=vec4(tint,clamp(a,0.0,1.0)*0.55); }
          else { t=texture2D(map,vec2(u,0.5)); t.rgb*=tint; }
          vec3 L=normalize(sunPos-vP); vec3 V=normalize(cameraPosition-vP);
          vec2 s=rsi(vP-center,L,planetR); float sh=(s.x>0.0)?0.04:1.0;
          float lit=0.25+0.75*abs(dot(ringN,L));
          float fwd=pow(max(dot(-V,L),0.0),8.0)*2.0;
          vec3 col=t.rgb*sunColor*sunI*(lit+fwd)*sh;
          gl_FragColor=vec4(col,t.a*0.96);
        }`,
    });
    ring = new THREE.Mesh(new THREE.RingGeometry(o.ring.inner * R, o.ring.outer * R, 256, 1), rm);
    ring.rotation.x = -Math.PI / 2;
    grp.add(ring);
  }
  if (o.tilt) grp.rotation.z = o.tilt;
  const spin = o.spin ?? 0.01;
  const _n = new THREE.Vector3();
  grp.userData.update = (dt, sunPos, sunColor) => {
    body.rotation.y += spin * dt;
    if (clouds) clouds.rotation.y += spin * 0.25 * dt;
    grp.updateMatrixWorld();
    u.sunPos.value.copy(sunPos);
    if (sunColor) u.sunColor.value.copy(sunColor);
    grp.getWorldPosition(u.center.value);
    _n.set(0, 1, 0).applyQuaternion(grp.getWorldQuaternion(new THREE.Quaternion()));
    u.ringN.value.copy(_n);
    if (atmo) atmo.userData.au.center.value.copy(u.center.value);
  };
  return grp;
}

// ---------- Stars ----------
export function makeStar(o) {
  const R = o.radius, T = o.temp ?? 5772;
  const grp = new THREE.Group();
  const u = { temp: { value: T }, map: { value: o.map || null }, hasMap: { value: o.map ? 1 : 0 }, time: shared.time, intensity: { value: o.intensity ?? 6 }, seed: { value: o.seed ?? 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: LOGV_PARS + `varying vec3 vN,vP,vO; varying vec2 vUv; void main(){ vUv=uv; vO=normal; vN=normalize(mat3(modelMatrix)*normal); vec4 wp=modelMatrix*vec4(position,1.0); vP=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; ${LOGV} }`,
    fragmentShader: LOGF_PARS + NOISE + BLACKBODY + `uniform float temp, hasMap, time, intensity, seed; uniform sampler2D map; varying vec3 vN,vP,vO; varying vec2 vUv;
      void main(){ ${LOGF}
        vec3 N=normalize(vN); vec3 V=normalize(cameraPosition-vP); float mu=max(dot(N,V),0.0);
        float g=fbm(vO*9.0+vec3(seed)+vec3(0.0,time*0.04,0.0));
        float cells=1.0-abs(snoise(vO*38.0+time*0.08));
        vec3 base=blackbody(temp);
        if(hasMap>0.5){ vec3 t=texture2D(map,vUv).rgb; base=mix(base,t*vec3(1.25,1.05,0.85),0.55); }
        float spots=smoothstep(0.55,0.75,fbm3(vO*3.0+vec3(seed*3.0)))*0.6;
        vec3 col=base*(0.78+0.32*g+0.15*cells)*(1.0-spots);
        float limb=0.35+0.65*pow(mu,0.55);
        col*=limb*mix(vec3(1.0,0.55,0.3),vec3(1.0),pow(mu,0.35));
        gl_FragColor=vec4(col*intensity*0.5,1.0);
      }`,
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 48), mat);
  grp.add(sphere);
  const cu = { color: { value: bbColor(T) }, time: shared.time, k: { value: o.corona ?? 7 }, inten: { value: o.coronaI ?? 1.6 }, seed: { value: o.seed ?? 0 } };
  const cm = new THREE.ShaderMaterial({
    uniforms: cu, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: LOGV_PARS + `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); ${LOGV} }`,
    fragmentShader: LOGF_PARS + NOISE + `uniform vec3 color; uniform float time,k,inten,seed; varying vec2 vUv;
      void main(){ ${LOGF}
        vec2 p=(vUv-0.5)*2.0*k; float r=length(p); if(r<0.97) discard;
        float a=atan(p.y,p.x);
        float glow=exp(-(r-1.0)*3.0)*0.75+0.04/(r*r);
        float st=snoise(vec3(cos(a)*2.5,sin(a)*2.5,seed+time*0.02))*0.5+0.5;
        float fine=snoise(vec3(cos(a)*14.0,sin(a)*14.0,r*0.3-time*0.03))*0.5+0.5;
        float streams=pow(st,2.0)*pow(fine,1.5)*exp(-(r-1.0)*1.2);
        float edge=smoothstep(k,k*0.6,r);
        vec3 c=color*(glow+streams*0.45)*edge*inten;
        gl_FragColor=vec4(c,1.0);
      }`,
  });
  const corona = new THREE.Mesh(new THREE.PlaneGeometry(2 * R * cu.k.value, 2 * R * cu.k.value), cm);
  grp.add(corona);
  grp.userData = { R, color: bbColor(T), update: (cam) => { corona.quaternion.copy(cam.quaternion); } };
  return grp;
}

// Distant star billboard (point-like glare)
export function makeGlare(color, size = 1, intensity = 3) {
  const m = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, inten: { value: intensity } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: LOGV_PARS + `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); ${LOGV} }`,
    fragmentShader: LOGF_PARS + `uniform vec3 color; uniform float inten; varying vec2 vUv; void main(){ ${LOGF} vec2 p=(vUv-0.5)*2.0; float r=length(p);
      float core=exp(-r*r*120.0)*6.0+exp(-r*18.0)*0.8+exp(-r*5.0)*0.12;
      float spikes=(exp(-abs(p.y)*160.0)+exp(-abs(p.x)*160.0))*exp(-r*3.5)*0.6;
      float a=(core+spikes)*smoothstep(1.0,0.6,r);
      gl_FragColor=vec4(color*a*inten,1.0); }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m);
  mesh.userData.update = (cam) => mesh.quaternion.copy(cam.quaternion);
  return mesh;
}

// ---------- Ship ----------
export function makeShip() {
  const ship = new THREE.Group();
  const hullMat = new THREE.MeshPhysicalMaterial({ color: '#c9ced6', metalness: 0.85, roughness: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.2, envMapIntensity: 0.6 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#2b3038', metalness: 0.6, roughness: 0.55, envMapIntensity: 0.4 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#c99a3e', metalness: 1, roughness: 0.35, envMapIntensity: 0.8 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#0b1a2e', metalness: 0.2, roughness: 0.05, clearcoat: 1, envMapIntensity: 1.5 });

  // hull profile (lathe around Y, nose toward +Y then rotate to +Z)
  const prof = [];
  const pts = [[0, 1.45], [0.04, 1.38], [0.1, 1.2], [0.16, 0.9], [0.2, 0.5], [0.22, 0.0], [0.22, -0.4], [0.2, -0.7], [0.24, -0.8], [0.24, -0.95], [0.18, -1.05], [0.0, -1.05]];
  for (const [r, y] of pts) prof.push(new THREE.Vector2(r, y));
  const hullGeo = new THREE.LatheGeometry(prof, 64);
  hullGeo.rotateX(Math.PI / 2);
  const hull = new THREE.Mesh(hullGeo, hullMat);
  ship.add(hull);
  // cockpit
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 16), glassMat);
  cockpit.scale.set(0.8, 0.55, 2.2); cockpit.position.set(0, 0.13, 0.85);
  ship.add(cockpit);
  // panel bands
  for (const z of [0.35, -0.15, -0.55]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.226, 0.226, 0.05, 64, 1, true), darkMat);
    band.rotation.x = Math.PI / 2; band.position.z = z; ship.add(band);
  }
  // gold foil module
  const mod = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.3, 24), goldMat);
  mod.rotation.x = Math.PI / 2; mod.position.set(0, -0.23, -0.2); ship.add(mod);
  // warp ring (Alcubierre-inspired)
  const ringMat = new THREE.MeshStandardMaterial({ color: '#1a2230', metalness: 0.9, roughness: 0.25, emissive: new THREE.Color('#4fb8ff'), emissiveIntensity: 1.2 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.03, 16, 128), ringMat);
  ring.position.z = -0.35; ship.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.012, 8, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.6, 3.2) }));
  ring2.position.z = -0.35; ring2.scale.setScalar(1.035); ship.add(ring2);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.52, 0.08), darkMat);
    strut.position.set(Math.cos(a) * 0.46, Math.sin(a) * 0.46, -0.35); strut.rotation.z = a - Math.PI / 2;
    ship.add(strut);
  }
  // radiator fins
  const finMat = new THREE.MeshStandardMaterial({ color: '#3a3f48', metalness: 0.4, roughness: 0.6, emissive: new THREE.Color('#ff5a1f'), emissiveIntensity: 0.0 });
  for (const s of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.012, 0.42), finMat);
    fin.position.set(s * 0.48, 0, 0.15); ship.add(fin);
    const fin2 = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.3, 0.3), darkMat);
    fin2.position.set(0, s * 0.33, -0.85); ship.add(fin2);
  }
  // engine bell
  const bellGeo = new THREE.CylinderGeometry(0.11, 0.17, 0.22, 48, 1, true);
  bellGeo.rotateX(Math.PI / 2);
  const bell = new THREE.Mesh(bellGeo, new THREE.MeshStandardMaterial({ color: '#555b63', metalness: 1, roughness: 0.4, side: THREE.DoubleSide }));
  bell.position.z = -1.15; ship.add(bell);
  const throat = new THREE.Mesh(new THREE.CircleGeometry(0.11, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.4, 4) }));
  throat.rotation.y = Math.PI; throat.position.z = -1.06; ship.add(throat);
  // nav lights
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 0.3, 0.3) }));
  navR.position.set(-0.76, 0, 0.15); ship.add(navR);
  const navG = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 8, 0.6) }));
  navG.position.set(0.76, 0, 0.15); ship.add(navG);

  // exhaust plume
  const plumeU = { time: shared.time, power: { value: 1 }, colA: { value: new THREE.Color(1.0, 0.9, 1.4) }, colB: { value: new THREE.Color(0.35, 0.45, 1.6) }, len: { value: 3 } };
  const mkPlume = (r0, r1, L, layer) => {
    const g = new THREE.CylinderGeometry(r0, r1, L, 48, 32, true);
    g.translate(0, -L / 2, 0); g.rotateX(Math.PI / 2); // extends toward -Z
    const m = new THREE.ShaderMaterial({
      uniforms: { ...plumeU, layer: { value: layer } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: LOGV_PARS + `varying vec2 vUv; varying vec3 vN,vP; void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); vec4 wp=modelMatrix*vec4(position,1.0); vP=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; ${LOGV} }`,
      fragmentShader: LOGF_PARS + NOISE + `uniform float time,power,layer; uniform vec3 colA,colB; varying vec2 vUv; varying vec3 vN,vP;
        void main(){ ${LOGF}
          float t=1.0-vUv.y; vec3 V=normalize(cameraPosition-vP);
          float edge=pow(abs(dot(normalize(vN),V)),1.4);
          float fall=pow(1.0-t,1.6+layer*1.5)*smoothstep(0.0,0.04,t+0.02);
          float diamonds=0.65+0.35*pow(abs(sin(t*28.0-time*2.0)),3.0)*(1.0-t);
          float n=0.75+0.25*snoise(vec3(vUv.x*8.0,t*6.0-time*14.0,layer));
          vec3 c=mix(colA,colB,clamp(t*1.6+layer*0.5,0.0,1.0));
          float a=fall*edge*diamonds*n*power*(layer>0.5?0.35:1.2);
          gl_FragColor=vec4(c*a,1.0);
        }`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; return mesh;
  };
  const plume = new THREE.Group(); plume.position.z = -1.12;
  plume.add(mkPlume(0.1, 0.16, 3.0, 0));
  plume.add(mkPlume(0.16, 0.55, 6.0, 1));
  ship.add(plume);

  ship.userData = {
    plumeU, ringMat, finMat, plume,
    setPlume(power, len, chemical) {
      plumeU.power.value = power;
      plume.scale.set(1, 1, len);
      if (chemical) { plumeU.colA.value.setRGB(3.0, 2.2, 1.2); plumeU.colB.value.setRGB(1.6, 0.55, 0.15); }
      else { plumeU.colA.value.setRGB(1.6, 1.5, 2.6); plumeU.colB.value.setRGB(0.35, 0.5, 2.2); }
    },
    tick(t) {
      const blink = (Math.sin(t * 6) > 0.7) ? 1 : 0.05;
      navR.material.color.setRGB(8 * blink, 0.3 * blink, 0.3 * blink);
      navG.material.color.setRGB(0.3 * blink, 8 * blink, 0.6 * blink);
    },
  };
  return ship;
}

// ---------- Asteroid field ----------
export function makeAsteroids({ count = 2500, inner = 100, outer = 600, thick = 60, seed = 3, color = '#8d8479', sizeMin = 0.3, sizeMax = 6, arc = Math.PI * 2, center = new THREE.Vector3() }) {
  const r = rng(seed);
  const geo = new THREE.IcosahedronGeometry(1, 3);
  const p = geo.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 1 + 0.22 * Math.sin(v.x * 3.1 + 1.3) * Math.cos(v.y * 2.7) + 0.12 * Math.sin(v.z * 7.3 + v.x * 4.1) + 0.06 * Math.sin(v.y * 13 + v.z * 9);
    v.multiplyScalar(n); p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.05, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3(), e = new THREE.Euler();
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const rad = inner + (outer - inner) * Math.sqrt(r());
    const th = (r() - 0.5) * arc;
    pos.set(Math.cos(th) * rad, gauss(r) * thick, Math.sin(th) * rad).add(center);
    const sz = sizeMin * Math.pow(sizeMax / sizeMin, Math.pow(r(), 3));
    s.set(sz * (0.7 + r() * 0.6), sz * (0.5 + r() * 0.5), sz * (0.7 + r() * 0.6));
    e.set(r() * 6, r() * 6, r() * 6); q.setFromEuler(e);
    m.compose(pos, q, s); mesh.setMatrixAt(i, m);
    c.set(color).multiplyScalar(0.6 + r() * 0.6); mesh.setColorAt(i, c);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

// ---------- Generic point cloud ----------
export function makePointCloud({ positions, colors, sizes, opacity = 1, blending = THREE.AdditiveBlending, dust = false, nearFade = 0 }) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { pxScale: shared.pxScale, opacity: { value: opacity }, nearFade: { value: nearFade } },
    vertexShader: LOGV_PARS + `attribute vec3 color; attribute float size; uniform float pxScale, opacity, nearFade; varying vec3 vC; varying float vA;
      void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; float d=max(-mv.z,1e-3);
        float ps=size*pxScale/d; vA=opacity;
        if(ps<1.5){ vA*=max(ps*ps/2.25,0.0); ps=1.5; }
        gl_PointSize=min(ps,${dust ? '160.0' : '90.0'});
        if(nearFade>0.0) vA*=smoothstep(nearFade*0.15,nearFade,d);
        vC=color; ${LOGV} }`,
    fragmentShader: LOGF_PARS + `varying vec3 vC; varying float vA; void main(){ ${LOGF} vec2 c=gl_PointCoord-0.5; float r=dot(c,c)*4.0; if(r>1.0) discard;
      ${dust ? 'float a=exp(-r*2.5)*(1.0-r); gl_FragColor=vec4(vC, a*vA);' : 'float a=exp(-r*6.0); gl_FragColor=vec4(vC*a*vA,1.0);'} }`,
    blending, depthWrite: false, transparent: true,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  return pts;
}

// ---------- Spiral galaxy ----------
export function makeGalaxy({ count = 160000, radius = 1000, arms = 4, pitch = 13, bar = 0.25, thickness = 0.03, seed = 9, tint = 1, dust = true, bulgeFrac = 0.18 }) {
  const r = rng(seed);
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), size = new Float32Array(count);
  const k = 1 / Math.tan(pitch * Math.PI / 180);
  const r0 = radius * 0.12;
  const cBulge = new THREE.Color(1.0, 0.78, 0.5), cOld = new THREE.Color(1.0, 0.88, 0.72), cYoung = new THREE.Color(0.62, 0.75, 1.0), cHII = new THREE.Color(1.0, 0.32, 0.52);
  const tmp = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const t = r();
    let x, y, z;
    if (t < bulgeFrac) {
      const rr = radius * 0.13 * Math.pow(r(), 1.6);
      const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      x = rr * s * Math.cos(th) * (1 + bar * 1.6); z = rr * s * Math.sin(th) * (1 - bar * 0.3); y = rr * u * 0.55;
      tmp.copy(cBulge).multiplyScalar(0.8 + r() * 0.6);
      size[i] = radius * (0.004 + r() * 0.004);
      tmp.multiplyScalar(1.3);
    } else {
      let rr = -Math.log(1 - r() * 0.985) * radius * 0.3;
      rr = Math.max(rr, radius * 0.06);
      const arm = Math.floor(r() * arms);
      let th;
      const onArm = r() < 0.72;
      const spread = 0.38 * (0.6 + 0.4 * r());
      if (onArm) th = Math.log(Math.max(rr, r0) / r0) * k + arm * 2 * Math.PI / arms + gauss(r) * spread * 0.55;
      else th = r() * Math.PI * 2;
      x = Math.cos(th) * rr; z = Math.sin(th) * rr;
      y = gauss(r) * radius * thickness * (0.6 + 0.6 * Math.exp(-rr / radius * 3));
      const young = onArm && r() < 0.55;
      if (onArm && r() < 0.018) { tmp.copy(cHII).multiplyScalar(2.2); size[i] = radius * 0.012; }
      else if (young) { tmp.copy(cYoung).multiplyScalar(0.9 + r() * 0.9); size[i] = radius * (0.003 + r() * 0.004); }
      else { tmp.copy(cOld).multiplyScalar(0.5 + r() * 0.5); size[i] = radius * (0.003 + r() * 0.003); }
    }
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    col[i * 3] = tmp.r * 0.05 * tint; col[i * 3 + 1] = tmp.g * 0.05 * tint; col[i * 3 + 2] = tmp.b * 0.05 * tint;
  }
  const grp = new THREE.Group();
  const stars = makePointCloud({ positions: pos, colors: col, sizes: size, opacity: 1 });
  grp.add(stars);
  // diffuse glow (unresolved stars)
  const gc = Math.floor(count * 0.12);
  const gp = new Float32Array(gc * 3), gcol = new Float32Array(gc * 3), gs = new Float32Array(gc);
  for (let i = 0; i < gc; i++) {
    const j = Math.floor(r() * count);
    gp[i * 3] = pos[j * 3]; gp[i * 3 + 1] = pos[j * 3 + 1]; gp[i * 3 + 2] = pos[j * 3 + 2];
    gcol[i * 3] = col[j * 3] * 0.25; gcol[i * 3 + 1] = col[j * 3 + 1] * 0.25; gcol[i * 3 + 2] = col[j * 3 + 2] * 0.25;
    gs[i] = radius * 0.05;
  }
  grp.add(makePointCloud({ positions: gp, colors: gcol, sizes: gs, opacity: 1 }));
  if (dust) {
    const dc = Math.floor(count * 0.18);
    const dp = new Float32Array(dc * 3), dcol = new Float32Array(dc * 3), ds = new Float32Array(dc);
    for (let i = 0; i < dc; i++) {
      let rr = -Math.log(1 - r() * 0.95) * radius * 0.28 + radius * 0.08;
      const arm = Math.floor(r() * arms);
      const th = Math.log(Math.max(rr, r0) / r0) * k + arm * 2 * Math.PI / arms - 0.18 + gauss(r) * 0.12;
      dp[i * 3] = Math.cos(th) * rr; dp[i * 3 + 1] = gauss(r) * radius * thickness * 0.35; dp[i * 3 + 2] = Math.sin(th) * rr;
      dcol[i * 3] = 0.05; dcol[i * 3 + 1] = 0.03; dcol[i * 3 + 2] = 0.02;
      ds[i] = radius * (0.02 + r() * 0.025);
    }
    const d = makePointCloud({ positions: dp, colors: dcol, sizes: ds, opacity: 0.32, blending: THREE.NormalBlending, dust: true });
    grp.add(d);
  }
  return grp;
}

// ---------- Volumetric nebula (Orion) ----------
export function makeNebula({ size = 3000, center = new THREE.Vector3() }) {
  const u = { noiseTex: { value: noise3D() }, bmin: { value: center.clone().addScalar(-size / 2) }, bmax: { value: center.clone().addScalar(size / 2) }, cen: { value: center.clone() }, size: { value: size }, time: shared.time, inten: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, depthTest: false, side: THREE.BackSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: `varying vec3 vP; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vP=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `precision highp sampler3D; uniform sampler3D noiseTex; uniform vec3 bmin,bmax,cen; uniform float size,time,inten; varying vec3 vP;
      float n3(vec3 p){ return texture(noiseTex,p).r; }
      float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        vec3 ro=cameraPosition; vec3 rd=normalize(vP-ro);
        vec3 inv=1.0/rd; vec3 t0s=(bmin-ro)*inv, t1s=(bmax-ro)*inv;
        vec3 tmin=min(t0s,t1s), tmax=max(t0s,t1s);
        float t0=max(max(tmin.x,tmin.y),max(tmin.z,0.0)); float t1=min(min(tmax.x,tmax.y),tmax.z);
        if(t1<=t0) discard;
        const int S=72; float dt=(t1-t0)/float(S);
        float t=t0+dt*hash(gl_FragCoord.xy+fract(time));
        vec3 acc=vec3(0.0); float tr=1.0;
        for(int i=0;i<S;i++){
          vec3 q=(ro+rd*t-cen)/size*2.0; // -1..1
          vec3 qs=q*vec3(1.0,1.25,1.5);
          float e=1.0-length(qs);
          if(e>-0.05){
            float n=n3(q*0.55+vec3(0.0,time*0.002,0.0))*0.65+n3(q*1.7+3.1)*0.35;
            float wisps=n3(q*3.3+7.0);
            float d=clamp(e*1.6+(n-0.5)*1.9+(wisps-0.5)*0.6-0.12,0.0,1.0);
            float cav=smoothstep(0.08,0.42,length(q-vec3(0.05,0.0,0.1)));
            d*=mix(0.12,1.0,cav);
            float ion=exp(-length(q)*3.2);
            vec3 cH=vec3(1.0,0.2,0.28), cO=vec3(0.22,0.78,0.85), cS=vec3(0.9,0.55,0.3);
            vec3 ce=mix(mix(cH,cS,smoothstep(0.4,0.8,n)),cO,smoothstep(0.1,0.7,ion*1.6));
            ce*=0.28+ion*0.8;
            float dust=smoothstep(0.52,0.75,n3(q*2.2+11.0))*smoothstep(0.0,0.4,e+0.1);
            float dd=d*dt/size*2.0*14.0;
            acc+=tr*ce*dd*inten*(1.0-dust*0.8);
            tr*=exp(-(d*0.5+dust*3.2)*dt/size*2.0*6.0);
            if(tr<0.02) break;
          }
          t+=dt;
        }
        gl_FragColor=vec4(acc,1.0-tr);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
  mesh.position.copy(center); mesh.renderOrder = -1; mesh.frustumCulled = false;
  return mesh;
}

// ---------- Black hole (Schwarzschild ray-traced) ----------
export function makeBlackHole({ rs = 10, skyTex }) {
  const u = { rs: { value: rs }, time: shared.time, sky: { value: skyTex }, bh: { value: new THREE.Vector3() }, tilt: { value: new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationX(0.12)) } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, depthWrite: false, depthTest: false, side: THREE.BackSide,
    vertexShader: `varying vec3 vD; void main(){ vD=position; vec4 wp=vec4(cameraPosition+position*1000.0,1.0); gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: NOISE + BLACKBODY + `uniform float rs,time; uniform sampler2D sky; uniform vec3 bh; uniform mat3 tilt; varying vec3 vD;
      vec3 bg(vec3 d){
        vec2 uv=vec2(atan(d.z,d.x)/6.2831853+0.5, asin(clamp(d.y,-1.0,1.0))/3.14159265+0.5);
        vec3 c=max(texture2D(sky,uv).rgb-0.02,0.0)*0.6;
        vec3 g=d*220.0; vec3 id=floor(g); float h=hash13(id);
        if(h>0.985){ vec3 f=fract(g)-0.5; float s=exp(-dot(f,f)*60.0)*(h-0.985)*300.0; c+=blackbody(3000.0+hash13(id+3.0)*9000.0)*s; }
        return c;
      }
      void main(){
        vec3 rd=normalize(vD);
        vec3 p=tilt*(cameraPosition-bh); vec3 v=tilt*rd;
        vec3 col=vec3(0.0); float tr=1.0;
        bool captured=false;
        float rIn=3.0*rs, rOut=14.0*rs;
        vec3 h3=cross(p,v); float h2=dot(h3,h3);
        for(int i=0;i<220;i++){
          float r=length(p);
          if(r<rs){ captured=true; break; }
          if(r>40.0*rs && dot(p,v)>0.0) break;
          float dt=clamp(0.06*r,0.02*rs,4.0*rs);
          vec3 a=-1.5*rs*h2*p/pow(r,5.0);
          vec3 pn=p+v*dt+0.5*a*dt*dt;
          v+=a*dt; v=normalize(v);
          if(p.y*pn.y<0.0){
            float f=p.y/(p.y-pn.y); vec3 hp=mix(p,pn,f); float rr=length(hp.xz);
            if(rr>rIn && rr<rOut){
              float x=rr/rIn;
              float T=pow(x,-0.75)*pow(max(1.0-sqrt(1.0/x),0.0),0.25)*14000.0;
              float ang=atan(hp.z,hp.x);
              float om=1.0/sqrt(pow(rr/rs,3.0))*4.0;
              float swirl=fbm3(vec3(cos(ang-time*om)*rr/rs*0.35,sin(ang-time*om)*rr/rs*0.35,rr/rs*0.6));
              vec3 vel=normalize(vec3(-hp.z,0.0,hp.x));
              float beta=clamp(sqrt(rs/(2.0*max(rr-rs,0.1))),0.0,0.7);
              float cosA=dot(vel,-v);
              float gam=1.0/sqrt(1.0-beta*beta);
              float D=1.0/(gam*(1.0-beta*cosA));
              float gR=sqrt(max(1.0-rs/rr,0.01));
              float Dt=D*gR;
              float dens=smoothstep(rIn,rIn*1.25,rr)*smoothstep(rOut,rOut*0.55,rr)*(0.55+0.9*swirl);
              vec3 e=blackbody(T*Dt)*pow(Dt,3.5)*dens*2.4*(0.6+T/14000.0);
              float al=clamp(dens*0.9,0.0,1.0);
              col+=tr*e*al; tr*=1.0-al*0.85;
              if(tr<0.02) break;
            }
          }
          p=pn;
        }
        if(!captured) col+=tr*bg(normalize(transpose(tilt)*v));
        gl_FragColor=vec4(col,1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
  m.frustumCulled = false; m.renderOrder = -20;
  return m;
}

// ---------- CMB / last scattering surface ----------
export function makeCMB(radius = 20000) {
  const u = { time: shared.time, opacity: { value: 1 }, inten: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, side: THREE.DoubleSide, transparent: true, depthWrite: false,
    vertexShader: LOGV_PARS + `varying vec3 vO,vN,vP; void main(){ vO=normalize(position); vN=normalize(mat3(modelMatrix)*normal); vec4 wp=modelMatrix*vec4(position,1.0); vP=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; ${LOGV} }`,
    fragmentShader: LOGF_PARS + NOISE + `uniform float time,opacity,inten; varying vec3 vO,vN,vP;
      vec3 planck(float x){ // x in -1..1  (Planck colormap approx)
        vec3 a=vec3(0.0,0.07,0.6), b=vec3(0.35,0.75,1.0), c=vec3(1.0,0.93,0.82), d=vec3(1.0,0.55,0.18), e=vec3(0.65,0.08,0.02);
        x=clamp(x*0.5+0.5,0.0,1.0);
        if(x<0.25) return mix(a,b,x/0.25); if(x<0.5) return mix(b,c,(x-0.25)/0.25); if(x<0.75) return mix(c,d,(x-0.5)/0.25); return mix(d,e,(x-0.75)/0.25);
      }
      void main(){ ${LOGF}
        vec3 d=vO;
        float f=snoise(d*3.0)*0.35+snoise(d*9.0)*0.3+snoise(d*24.0)*0.22+snoise(d*60.0)*0.13;
        vec3 c=planck(f*1.6);
        vec3 V=normalize(cameraPosition-vP);
        float fr=pow(1.0-abs(dot(normalize(vN),V)),2.0);
        gl_FragColor=vec4(c*inten*(0.55+fr*0.6),opacity);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 128, 64), mat);
  m.frustumCulled = false;
  m.userData.u = u;
  return m;
}

// ---------- Heliosphere ----------
export function makeShell({ radius, color = '#5aa9ff', strength = 0.5, scale = [1, 1, 1], noise = 1 }) {
  const u = { color: { value: new THREE.Color(color) }, strength: { value: strength }, time: shared.time, nz: { value: noise } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: LOGV_PARS + `varying vec3 vN,vP,vO; void main(){ vO=position; vN=normalize(mat3(modelMatrix)*normal); vec4 wp=modelMatrix*vec4(position,1.0); vP=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; ${LOGV} }`,
    fragmentShader: LOGF_PARS + NOISE + `uniform vec3 color; uniform float strength,time,nz; varying vec3 vN,vP,vO;
      void main(){ ${LOGF} vec3 V=normalize(cameraPosition-vP); float f=pow(1.0-abs(dot(normalize(vN),V)),3.0);
        float n=0.6+0.4*fbm3(normalize(vO)*4.0+time*0.02)*nz;
        gl_FragColor=vec4(color*f*strength*n,1.0); }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 48), mat);
  m.scale.set(...scale);
  return m;
}

// ---------- Distant galaxy sprites (canvas-painted) ----------
let _galTex = null;
function galaxyTextures() {
  if (_galTex) return _galTex;
  _galTex = [];
  for (let k = 0; k < 8; k++) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'); const r = rng(100 + k);
    g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
    g.globalCompositeOperation = 'lighter';
    const spiral = k % 3 !== 2;
    const n = 2600;
    for (let i = 0; i < n; i++) {
      let x, y, a;
      if (spiral && r() > 0.3) {
        const rr = Math.pow(r(), 0.7) * 52; const arm = Math.floor(r() * 2);
        const th = Math.log(rr / 4 + 1) * 3.2 + arm * Math.PI + gauss(r) * 0.35;
        x = 64 + Math.cos(th) * rr; y = 64 + Math.sin(th) * rr * 0.45;
        a = 0.08;
        g.fillStyle = r() < 0.5 ? `rgba(160,190,255,${a})` : `rgba(255,220,190,${a})`;
      } else {
        const rr = Math.abs(gauss(r)) * (spiral ? 10 : 22);
        const th = r() * Math.PI * 2;
        x = 64 + Math.cos(th) * rr; y = 64 + Math.sin(th) * rr * (spiral ? 0.6 : 0.7);
        g.fillStyle = `rgba(255,214,160,0.1)`;
      }
      g.fillRect(x, y, 1.2, 1.2);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    _galTex.push(t);
  }
  return _galTex;
}

export function makeGalaxyField({ count = 500, rMin = 3000, rMax = 9000, sizeMin = 40, sizeMax = 220, seed = 5, redshift = 0 }) {
  const tex = galaxyTextures();
  const r = rng(seed);
  const grp = new THREE.Group();
  const mats = tex.map(t => new THREE.ShaderMaterial({
    uniforms: { map: { value: t }, tint: { value: new THREE.Color(1, 1, 1) }, red: { value: redshift } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: LOGV_PARS + `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); ${LOGV} }`,
    fragmentShader: LOGF_PARS + `uniform sampler2D map; uniform float red; varying vec2 vUv; void main(){ ${LOGF} vec3 c=texture2D(map,vUv).rgb; c=mix(c,c.rrr*vec3(1.0,0.45,0.2)*1.4,red); gl_FragColor=vec4(c*1.3,1.0); }`,
    side: THREE.DoubleSide,
  }));
  const geo = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geo, mats[Math.floor(r() * mats.length)]);
    const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    const rad = rMin + (rMax - rMin) * r();
    m.position.set(s * Math.cos(th) * rad, u * rad, s * Math.sin(th) * rad);
    const sz = sizeMin * Math.pow(sizeMax / sizeMin, Math.pow(r(), 2.5));
    m.scale.setScalar(sz);
    m.rotation.set(r() * 6, r() * 6, r() * 6);
    grp.add(m);
  }
  return grp;
}

// ---------- Cosmic web ----------
export function makeCosmicWeb({ nodes = 90, extent = 6000, count = 220000, seed = 11, center = new THREE.Vector3() }) {
  const r = rng(seed);
  const N = [];
  for (let i = 0; i < nodes; i++) N.push(new THREE.Vector3((r() - 0.5) * extent, (r() - 0.5) * extent * 0.8, (r() - 0.5) * extent).add(center));
  const mass = N.map(() => 0.3 + Math.pow(r(), 3) * 2.5);
  const edges = [];
  N.forEach((a, i) => {
    const d = N.map((b, j) => [a.distanceTo(b), j]).filter(x => x[1] !== i).sort((x, y) => x[0] - y[0]);
    for (let k = 0; k < 3; k++) { const j = d[k][1]; if (i < j) edges.push([i, j]); }
  });
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), size = new Float32Array(count);
  const v = new THREE.Vector3();
  const nodeShare = 0.38;
  for (let i = 0; i < count; i++) {
    if (r() < nodeShare) {
      const n = Math.floor(r() * nodes);
      const s = 18 + mass[n] * 40;
      v.set(gauss(r) * s, gauss(r) * s, gauss(r) * s).add(N[n]);
      const b = 0.5 + r() * 0.5;
      col.set([1.0 * b, 0.82 * b, 0.6 * b], i * 3);
      size[i] = 4 + r() * 5;
    } else {
      const [a, b] = edges[Math.floor(r() * edges.length)];
      const t = r();
      v.lerpVectors(N[a], N[b], t);
      const w = 22 + 30 * Math.sin(t * Math.PI);
      v.x += gauss(r) * w; v.y += gauss(r) * w; v.z += gauss(r) * w;
      const bb = 0.35 + r() * 0.5;
      col.set([0.7 * bb, 0.8 * bb, 1.0 * bb], i * 3);
      size[i] = 3 + r() * 3;
    }
    pos.set([v.x, v.y, v.z], i * 3);
  }
  for (let i = 0; i < col.length; i++) col[i] *= 0.55;
  const grp = new THREE.Group();
  grp.add(makePointCloud({ positions: pos, colors: col, sizes: size, nearFade: 60 }));
  // gas glow along filaments
  const gc = 26000; const gp = new Float32Array(gc * 3), gcol = new Float32Array(gc * 3), gs = new Float32Array(gc);
  for (let i = 0; i < gc; i++) {
    const [a, b] = edges[Math.floor(r() * edges.length)];
    v.lerpVectors(N[a], N[b], r());
    v.x += gauss(r) * 40; v.y += gauss(r) * 40; v.z += gauss(r) * 40;
    gp.set([v.x, v.y, v.z], i * 3);
    gcol.set([0.012, 0.016, 0.03], i * 3);
    gs[i] = 120 + r() * 120;
  }
  grp.add(makePointCloud({ positions: gp, colors: gcol, sizes: gs, nearFade: 200 }));
  grp.userData.nodes = N; grp.userData.mass = mass;
  return grp;
}
