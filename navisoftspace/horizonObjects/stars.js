import * as THREE from 'three';

export function createStars({
    count = 50000,
    radius = 2000000,
    seed = 12345
} = {}) {

    // ============================================================
    // 1. FAST DETERMINISTIC RANDOM GENERATOR
    // ============================================================

    let state = seed >>> 0;

    function random() {
        state += 0x6D2B79F5;

        let t = state;

        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    // ============================================================
    // 2. GPU-FRIENDLY BUFFERS
    // ============================================================

    const positions = new Float32Array(count * 3);

    // RGB colors, normalized when uploaded to GPU
    const colors = new Uint8Array(count * 3);

    // Individual star size factor
    const sizes = new Uint8Array(count);

    const starColor = new THREE.Color();

    // ============================================================
    // 3. CREATE STARS
    // ============================================================

    for (let i = 0; i < count; i++) {

        let x;
        let y;
        let z;
        let lengthSq;

        // Generate a point inside a unit sphere
        do {
            x = random() * 2.0 - 1.0;
            y = random() * 2.0 - 1.0;
            z = random() * 2.0 - 1.0;

            lengthSq =
                x * x +
                y * y +
                z * z;

        } while (
            lengthSq > 1.0 ||
            lengthSq === 0.0
        );

        // Uniform volume distribution
        const distance =
            radius * Math.cbrt(random());

        const index = i * 3;

        positions[index] =
            x * distance;

        positions[index + 1] =
            y * distance;

        positions[index + 2] =
            z * distance;

        // ========================================================
        // 4. NATURAL STAR COLOR DISTRIBUTION
        // ========================================================

        const temperature = random();

        if (temperature < 0.08) {

            // Orange / red stars
            starColor.setRGB(
                1.0,
                0.72,
                0.48
            );

        } else if (temperature < 0.20) {

            // Warm white
            starColor.setRGB(
                1.0,
                0.86,
                0.68
            );

        } else if (temperature < 0.82) {

            // Normal white stars
            starColor.setRGB(
                1.0,
                0.97,
                0.92
            );

        } else if (temperature < 0.96) {

            // Blue-white stars
            starColor.setRGB(
                0.82,
                0.90,
                1.0
            );

        } else {

            // Rare blue stars
            starColor.setRGB(
                0.65,
                0.80,
                1.0
            );
        }

        colors[index] =
            Math.round(starColor.r * 255);

        colors[index + 1] =
            Math.round(starColor.g * 255);

        colors[index + 2] =
            Math.round(starColor.b * 255);

        // ========================================================
        // 5. STAR SIZE DISTRIBUTION
        // ========================================================

        const brightness = random();

        let size;

        if (brightness < 0.94) {

            // 94% tiny stars
            size =
                1.0 +
                random() * 2.5;

        } else if (brightness < 0.995) {

            // 5.5% medium stars
            size =
                3.0 +
                random() * 5.0;

        } else {

            // 0.5% rare bright stars
            size =
                7.0 +
                random() * 5.0;
        }

        // Store 0-255
        sizes[i] =
            Math.round(
                THREE.MathUtils.clamp(
                    size / 12.0,
                    0.0,
                    1.0
                ) * 255
            );
    }

    // ============================================================
    // 6. BUFFER GEOMETRY
    // ============================================================

    const geometry =
        new THREE.BufferGeometry();

    geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(
            positions,
            3
        )
    );

    geometry.setAttribute(
        'aColor',
        new THREE.BufferAttribute(
            colors,
            3,
            true
        )
    );

    geometry.setAttribute(
        'aSize',
        new THREE.BufferAttribute(
            sizes,
            1,
            true
        )
    );

    // Generate bounding sphere for frustum culling
    geometry.computeBoundingSphere();

    // ============================================================
    // 7. GPU SHADER MATERIAL
    // ============================================================

    const material =
        new THREE.ShaderMaterial({

            uniforms: {
                uPixelRatio: {
                    value: Math.min(
                        window.devicePixelRatio,
                        2.0
                    )
                }
            },

            vertexShader: /* glsl */`

                attribute vec3 aColor;
                attribute float aSize;

                varying vec3 vColor;

                uniform float uPixelRatio;

                void main() {

                    // Transform star into camera space
                    vec4 mvPosition =
                        modelViewMatrix *
                        vec4(position, 1.0);

                    // Convert encoded size back to 0-1
                    float sizeFactor =
                        aSize;

                    // Base star size
                    float baseSize =
                        mix(
                            1.0,
                            12.0,
                            sizeFactor
                        );

                    // Perspective scaling
                    float perspectiveSize =
                        baseSize *
                        (300.0 /
                        max(
                            1.0,
                            -mvPosition.z
                        ));

                    // VERY IMPORTANT:
                    // Prevent huge point sprites
                    // from destroying fill-rate.
                    gl_PointSize =
                        clamp(
                            perspectiveSize *
                            uPixelRatio,
                            1.0,
                            12.0
                        );

                    gl_Position =
                        projectionMatrix *
                        mvPosition;

                    vColor = aColor;
                }
            `,

            fragmentShader: /* glsl */`

                varying vec3 vColor;

                void main() {

                    // Point sprite coordinates
                    vec2 uv =
                        gl_PointCoord -
                        vec2(0.5);

                    float distanceFromCenter =
                        length(uv) * 2.0;

                    // Remove corners
                    if (
                        distanceFromCenter > 1.0
                    ) {
                        discard;
                    }

                    // Bright central core
                    float core =
                        1.0 -
                        smoothstep(
                            0.0,
                            0.30,
                            distanceFromCenter
                        );

                    // Soft surrounding halo
                    float halo =
                        1.0 -
                        smoothstep(
                            0.15,
                            1.0,
                            distanceFromCenter
                        );

                    // Combined star brightness
                    float alpha =
                        core * 0.95 +
                        halo * 0.20;

                    gl_FragColor =
                        vec4(
                            vColor,
                            alpha
                        );
                }
            `,

            // Transparency required for soft stars
            transparent: true,

            // Stars blend together naturally
            blending: THREE.AdditiveBlending,

            // Prevents stars from writing into depth buffer
            depthWrite: false,

            // Still allows objects in front to hide stars
            depthTest: true,

            // Don't let lighting affect star colors
            toneMapped: false,

            // Stars shouldn't receive scene fog
            fog: false
        });

    // ============================================================
    // 8. CREATE STAR FIELD
    // ============================================================

    const starField =
        new THREE.Points(
            geometry,
            material
        );

    // IMPORTANT:
    // Allow Three.js to perform normal frustum culling.
    starField.frustumCulled = true;

    // Static geometry never needs its transform rebuilt.
    starField.matrixAutoUpdate = false;
    starField.updateMatrix();

    // Identify it elsewhere in your engine
    starField.userData = {
        name: 'STARFIELD'
    };

    return starField;
}
