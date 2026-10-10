import * as THREE from "three";

/**
 * Creates a MeshPhysicalMaterial with customized procedural gold vein & quartz shader chunks.
 */
export function createOreMaterial(): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#2A3431"),
    roughness: 0.85,
    metalness: 0.1,
    clearcoat: 0.2,
    clearcoatRoughness: 0.4,
    flatShading: true,
  });

  mat.onBeforeCompile = (shader) => {
    // Inject custom varying in vertex shader
    shader.vertexShader = `
      varying vec3 vObjPos;
      ${shader.vertexShader}
    `;

    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
      #include <begin_vertex>
      vObjPos = position;
      `
    );

    // Procedural 3D noise functions for fragment shader
    const noiseChunk = `
      varying vec3 vObjPos;

      // Deterministic 3D hash
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

      float snoise3D(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);

        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);

        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;

        i = mod289(i);
        vec4 p = permute(permute(permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0));

        float n_ = 0.142857142857;
        vec3  ns = n_ * D.wyz - D.xzx;

        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);

        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);

        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);

        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));

        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);

        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;

        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
      }
    `;

    shader.fragmentShader = `
      ${noiseChunk}
      ${shader.fragmentShader}
    `;

    // Modify diffuse, roughness, and metalness calculations
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `
      #include <color_fragment>

      // 1. Vein noise pattern
      vec3 p = vObjPos * 2.8;
      float n1 = snoise3D(p);
      float n2 = snoise3D(p * 2.1 + vec3(4.3, 1.7, 8.2));
      float veinBand = abs(n1 + n2 * 0.45);
      
      // Vein mask: sharp narrow veins running along fractures
      float isVein = 1.0 - smoothstep(0.04, 0.16, veinBand);

      // 2. Quartz inclusions patch noise
      float quartzNoise = snoise3D(vObjPos * 1.5 + vec3(9.2, 3.1, 1.8));
      float isQuartz = smoothstep(0.40, 0.65, quartzNoise) * (1.0 - isVein);

      // 3. Color palette
      vec3 slateColor  = vec3(0.12, 0.16, 0.15); // dark slate basalt
      vec3 quartzColor = vec3(0.58, 0.62, 0.60); // pale quartz
      vec3 goldColor   = vec3(0.85, 0.72, 0.32); // warm MCX gold

      vec3 rockColor = mix(slateColor, quartzColor, isQuartz);
      diffuseColor.rgb = mix(rockColor, goldColor, isVein);
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      `
      #include <roughnessmap_fragment>
      // Gold is smooth (0.22); quartz is 0.48; slate rock is rough (0.88)
      float targetRoughness = mix(mix(0.88, 0.48, isQuartz), 0.22, isVein);
      roughnessFactor = targetRoughness;
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <metalnessmap_fragment>",
      `
      #include <metalnessmap_fragment>
      // Gold is fully metallic (1.0); rock substrate is non-metallic (0.02)
      metalnessFactor = mix(0.02, 1.0, isVein);
      `
    );
  };

  return mat;
}

/**
 * Creates pure metallic gold material for instanced flecks.
 */
export function createFleckMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color("#E6CF8F"),
    metalness: 1.0,
    roughness: 0.22,
    flatShading: true,
  });
}
