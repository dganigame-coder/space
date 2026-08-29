import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

/*
 * Scientifically restrained / non-sci-fi 'Oumuamua-style anomaly.
 *
 * Goals:
 * - irregular elongated rocky body
 * - natural asymmetry
 * - procedural geological variation
 * - non-metallic PBR appearance
 * - fine surface detail in GLSL
 * - realistic dark reddish/brown rock
 * - no emissive glow
 * - no artificial beacon
 * - preserves the existing createInterstellarAnomaly() API
 */

export function createInterstellarAnomaly(scene, config = {}) {
    const anomalyGroup = new THREE.Group();

    // =====================================================================
    // 1. GEOMETRY
    // =====================================================================

    /*
     * High enough tessellation that the silhouette itself can carry
     * irregular detail. Surface micro-detail is handled by the shader.
     *
     * This is deliberately preferable to an enormous geometry because
     * tiny detail should come from shading, not millions of triangles.
     */
    const rockGeo = new THREE.SphereGeometry(
        150,
        config.segments || 128,
        config.rings || 96
    );

    const position = rockGeo.attributes.position;
    const v = new THREE.Vector3();

    // ---------------------------------------------------------------------
    // Deterministic 3D value noise
    // ---------------------------------------------------------------------

    function hash3(x, y, z) {
        const h = Math.sin(
            x * 127.1 +
            y * 311.7 +
            z * 74.7
        ) * 43758.5453123;

        return h - Math.floor(h);
    }

    function fade(t) {
        return t * t * (3.0 - 2.0 * t);
    }

    function noise3D(x, y, z) {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const iz = Math.floor(z);

        const fx = fade(x - ix);
        const fy = fade(y - iy);
        const fz = fade(z - iz);

        const n000 = hash3(ix,     iy,     iz);
        const n100 = hash3(ix + 1, iy,     iz);
        const n010 = hash3(ix,     iy + 1, iz);
        const n110 = hash3(ix + 1, iy + 1, iz);

        const n001 = hash3(ix,     iy,     iz + 1);
        const n101 = hash3(ix + 1, iy,     iz + 1);
        const n011 = hash3(ix,     iy + 1, iz + 1);
        const n111 = hash3(ix + 1, iy + 1, iz + 1);

        const x00 = THREE.MathUtils.lerp(n000, n100, fx);
        const x10 = THREE.MathUtils.lerp(n010, n110, fx);
        const x01 = THREE.MathUtils.lerp(n001, n101, fx);
        const x11 = THREE.MathUtils.lerp(n011, n111, fx);

        const y0 = THREE.MathUtils.lerp(x00, x10, fy);
        const y1 = THREE.MathUtils.lerp(x01, x11, fy);

        return THREE.MathUtils.lerp(y0, y1, fz);
    }

    function fbm(x, y, z, octaves = 5) {
        let value = 0.0;
        let amplitude = 0.5;
        let frequency = 1.0;

        for (let i = 0; i < octaves; i++) {
            value += noise3D(
                x * frequency,
                y * frequency,
                z * frequency
            ) * amplitude;

            frequency *= 2.0;
            amplitude *= 0.5;
        }

        return value;
    }

    // ---------------------------------------------------------------------
    // Large / medium silhouette deformation
    // ---------------------------------------------------------------------

    for (let i = 0; i < position.count; i++) {
        v.fromBufferAttribute(position, i);

        const nx = v.x / 150;
        const ny = v.y / 150;
        const nz = v.z / 150;

        const large = fbm(
            nx * 1.65,
            ny * 1.65,
            nz * 1.65,
            5
        );

        const medium = fbm(
            nx * 5.0,
            ny * 5.0,
            nz * 5.0,
            4
        );

        const fine = fbm(
            nx * 16.0,
            ny * 16.0,
            nz * 16.0,
            3
        );

        /*
         * Natural taper toward the ends.
         * The object remains elongated without looking like
         * a mathematically stretched sphere.
         */
        const axial = Math.abs(nz);

        const taper =
            1.0 -
            Math.pow(axial, 2.7) * 0.20;

        const radialVariation =
            1.0 +
            (large - 0.5) * 0.22 +
            (medium - 0.5) * 0.075 +
            (fine - 0.5) * 0.022;

        const deformation =
            taper * radialVariation;

        v.x *= deformation;
        v.y *= deformation;
        v.z *= deformation;

        /*
         * Very subtle asymmetry / bending.
         * Intentionally small so the shape remains believable.
         */
        v.x += Math.sin(nz * Math.PI * 2.3) * 1.8;
        v.y += Math.cos(nz * Math.PI * 1.7) * 1.1;

        position.setXYZ(i, v.x, v.y, v.z);
    }

    rockGeo.computeVertexNormals();

    // =====================================================================
    // 2. PHYSICALLY RESTRAINED PBR MATERIAL
    // =====================================================================

    const rockMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.115, 0.082, 0.070),

        /*
         * Asteroidal rock is treated as a dielectric.
         */
        metalness: 0.0,

        /*
         * Very rough overall surface.
         * The shader below adds additional micro variation.
         */
        roughness: 0.89,

        /*
         * Small amount of flat micro-normal variation through
         * Three.js' normal system.
         */
        bumpScale: 0.18
    });

    rockMat.name =
        'Oumuamua_Photorealistic_Rock';

    // =====================================================================
    // 3. CUSTOM SURFACE SHADER
    // =====================================================================

    /*
     * We inject procedural microstructure into the standard PBR material.
     *
     * This means:
     * - the base color varies by region
     * - roughness varies naturally
     * - tiny rocky structure modifies the normal
     *
     * without requiring a giant external texture package.
     */

    rockMat.onBeforeCompile = (shader) => {

        shader.uniforms.uRockScale = {
            value: config.rockScale || 3.0
        };

        shader.uniforms.uMicroScale = {
            value: config.microScale || 48.0
        };

        shader.vertexShader = shader.vertexShader
            .replace(
                '#include <common>',
                `
                #include <common>

                varying vec3 vRockWorldPosition;
                varying vec3 vRockNormal;

                uniform float uRockScale;
                uniform float uMicroScale;

                float rockHash(vec3 p) {
                    p = fract(p * 0.3183099 + vec3(0.1, 0.7, 0.3));
                    p *= 17.0;
                    return fract(
                        p.x * p.y * p.z *
                        (p.x + p.y + p.z)
                    );
                }

                float rockNoise(vec3 p) {
                    vec3 i = floor(p);
                    vec3 f = fract(p);

                    f = f * f * (3.0 - 2.0 * f);

                    float n000 = rockHash(i);
                    float n100 = rockHash(i + vec3(1.0, 0.0, 0.0));
                    float n010 = rockHash(i + vec3(0.0, 1.0, 0.0));
                    float n110 = rockHash(i + vec3(1.0, 1.0, 0.0));

                    float n001 = rockHash(i + vec3(0.0, 0.0, 1.0));
                    float n101 = rockHash(i + vec3(1.0, 0.0, 1.0));
                    float n011 = rockHash(i + vec3(0.0, 1.0, 1.0));
                    float n111 = rockHash(i + vec3(1.0, 1.0, 1.0));

                    float nx00 = mix(n000, n100, f.x);
                    float nx10 = mix(n010, n110, f.x);
                    float nx01 = mix(n001, n101, f.x);
                    float nx11 = mix(n011, n111, f.x);

                    float nxy0 = mix(nx00, nx10, f.y);
                    float nxy1 = mix(nx01, nx11, f.y);

                    return mix(nxy0, nxy1, f.z);
                }

                float rockFbm(vec3 p) {
                    float value = 0.0;
                    float amplitude = 0.5;

                    for (int i = 0; i < 5; i++) {
                        value += rockNoise(p) * amplitude;
                        p *= 2.03;
                        amplitude *= 0.5;
                    }

                    return value;
                }
                `
            )
            .replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>

                vec3 rockP = normalize(transformed);

                /*
                 * Very small micro-displacement.
                 * Large shape remains geometry-driven.
                 */
                float micro =
                    rockFbm(
                        rockP * uMicroScale
                    );

                transformed +=
                    normal *
                    ((micro - 0.5) * 0.55);
                `
            )
            .replace(
                '#include <worldpos_vertex>',
                `
                #include <worldpos_vertex>

                vRockWorldPosition =
                    worldPosition.xyz;

                vRockNormal =
                    normalize(
                        mat3(modelMatrix) *
                        transformedNormal
                    );
                `
            );

        shader.fragmentShader = shader.fragmentShader
            .replace(
                '#include <color_pars_fragment>',
                `
                #include <color_pars_fragment>

                varying vec3 vRockWorldPosition;
                varying vec3 vRockNormal;
                `
            )
            .replace(
                '#include <color_fragment>',
                `
                #include <color_fragment>

                vec3 rp =
                    normalize(vRockWorldPosition);

                float broad =
                    rockFbm(rp * 3.0);

                float mineral =
                    rockFbm(
                        rp * 11.0 +
                        vec3(13.2, -7.1, 4.7)
                    );

                float grain =
                    rockFbm(rp * 42.0);

                /*
                 * Very restrained carbonaceous-rock palette.
                 */
                vec3 darkRock =
                    vec3(0.045, 0.036, 0.032);

                vec3 warmRock =
                    vec3(0.145, 0.105, 0.085);

                vec3 weatheredRock =
                    vec3(0.19, 0.145, 0.118);

                vec3 rockColor =
                    mix(
                        darkRock,
                        warmRock,
                        smoothstep(0.20, 0.72, broad)
                    );

                rockColor =
                    mix(
                        rockColor,
                        weatheredRock,
                        smoothstep(0.55, 0.90, mineral)
                        * 0.32
                    );

                /*
                 * Fine granular modulation.
                 */
                rockColor *=
                    0.90 +
                    grain * 0.16;

                diffuseColor.rgb =
                    rockColor;
                `
            );

        /*
         * Store shader reference for possible future updates.
         */
        rockMat.userData.shader =
            shader;
    };

    const oumuamuaMesh =
        new THREE.Mesh(
            rockGeo,
            rockMat
        );

    oumuamuaMesh.name =
        'oumuamuaMesh';

    /*
     * Elongated but not absurdly thin.
     *
     * These proportions can be adjusted without touching
     * the procedural surface.
     */
    oumuamuaMesh.scale.set(
        1.0,
        1.18,
        9.4
    );

    oumuamuaMesh.castShadow = true;
    oumuamuaMesh.receiveShadow = true;

    anomalyGroup.add(
        oumuamuaMesh
    );

    // =====================================================================
    // 4. OPTIONAL VERY SUBTLE NATURAL DUST
    // =====================================================================

    /*
     * Disabled by default.
     *
     * This is deliberately NOT a glowing sci-fi effect.
     * It can represent sparse dust if your simulation needs it.
     */
    if (config.showDust === true) {

        const dustCount =
            config.dustCount || 150;

        const dustPositions =
            new Float32Array(
                dustCount * 3
            );

        for (let i = 0; i < dustCount; i++) {
            const i3 = i * 3;

            const angle =
                Math.random() *
                Math.PI * 2;

            const radius =
                190 +
                Math.random() * 160;

            const z =
                (
                    Math.random() - 0.5
                ) * 2800;

            dustPositions[i3] =
                Math.cos(angle) *
                radius;

            dustPositions[i3 + 1] =
                Math.sin(angle) *
                radius *
                0.75;

            dustPositions[i3 + 2] =
                z;
        }

        const dustGeo =
            new THREE.BufferGeometry();

        dustGeo.setAttribute(
            'position',
            new THREE.BufferAttribute(
                dustPositions,
                3
            )
        );

        const dustMat =
            new THREE.PointsMaterial({
                color: 0xb7aa9f,
                size: 2.0,
                transparent: true,
                opacity: 0.07,
                depthWrite: false,
                sizeAttenuation: true
            });

        const dust =
            new THREE.Points(
                dustGeo,
                dustMat
            );

        dust.name =
            'naturalSparseDust';

        anomalyGroup.add(dust);
    }

    // =====================================================================
    // 5. IDENTITY / SCANNER INTEGRATION
    // =====================================================================

    const targetName =
        config.name ||
        "'Oumuamua / Interstellar Wanderer";

    anomalyGroup.name =
        targetName;

    anomalyGroup.userData = {
        type: 'solid',

        name: targetName,

        innerRadius:
            config.innerRadius || 0,

        outerRadius:
            config.outerRadius || 50000,

        /*
         * Compound tumble.
         *
         * The entire asteroid group rotates, so every attached physical
         * component remains rigidly connected.
         */
        update: (time) => {
            const t =
                time * 0.0001;

            anomalyGroup.rotation.x =
                t * 0.31;

            anomalyGroup.rotation.y =
                t * 0.19;

            anomalyGroup.rotation.z =
                t * 0.11;

            /*
             * Tiny non-linear wobble to avoid perfectly uniform spinning.
             */
            anomalyGroup.rotation.x +=
                Math.sin(t * 0.73) * 0.045;

            anomalyGroup.rotation.y +=
                Math.sin(t * 0.47) * 0.035;
        }
    };

    // =====================================================================
    // 6. POSITION
    // =====================================================================

    anomalyGroup.position.set(
        config.x || 0,
        config.y || 0,
        config.z || 0
    );

    scene.add(
        anomalyGroup
    );

    return anomalyGroup;
}
