import * as THREE from 'three';

/**
 * GLSL Mystic Flower Well Vortex Shader
 * Creates swirling petal rings, rotating mystic runes, and gravity-field glow
 */
export const FlowerWellVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vPosition = position;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const FlowerWellFragmentShader = `
  uniform float uTime;
  uniform vec3 uCoreColor;
  uniform vec3 uPetalColor;
  uniform float uWellType; // 0 = Standard, 1 = Pulsing, 2 = Binary
  uniform float uPulseIntensity;

  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;

  void main() {
    vec2 p = vUv - vec2(0.5);
    float dist = length(p) * 2.0; // 0 at center, 1 at edge
    if (dist > 1.0) discard;

    float angle = atan(p.y, p.x);

    // Swirling flow field rotation
    float swirl = angle + dist * 6.0 - uTime * (2.5 + uPulseIntensity * 1.5);

    // Procedural Mystic Petal Pattern (5 or 8 petals)
    float petals = sin(swirl * 6.0) * 0.5 + 0.5;
    float rings = sin(dist * 20.0 - uTime * 4.0) * 0.5 + 0.5;

    // Glowing core gradient
    float core = 1.0 - smoothstep(0.0, 0.45, dist);
    float edge = smoothstep(0.7, 1.0, dist);

    // Well type variations
    vec3 colorA = uCoreColor;
    vec3 colorB = uPetalColor;

    if (uWellType > 0.5 && uWellType < 1.5) {
      // Pulsing well: shift color with pulse
      colorA = mix(uCoreColor, vec3(1.0, 0.2, 0.6), uPulseIntensity);
      colorB = mix(uPetalColor, vec3(0.9, 0.8, 0.1), uPulseIntensity);
    } else if (uWellType >= 1.5) {
      // Binary well: dual chromatic shift
      colorA = mix(uCoreColor, vec3(0.6, 0.1, 1.0), sin(uTime * 3.0) * 0.5 + 0.5);
      colorB = mix(uPetalColor, vec3(0.1, 0.9, 0.9), cos(uTime * 3.0) * 0.5 + 0.5);
    }

    vec3 finalColor = mix(colorA, colorB, dist);
    finalColor += colorB * petals * 0.6;
    finalColor += vec3(1.0, 0.9, 0.5) * rings * 0.3 * (1.0 - dist);
    finalColor += vec3(1.0) * pow(core, 2.0) * 1.2;

    float alpha = (1.0 - dist) * (0.6 + petals * 0.3 + core * 0.4);
    alpha *= (1.0 + uPulseIntensity * 0.4);
    alpha = clamp(alpha, 0.0, 0.95);

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export function createFlowerWellMaterial(wellType: number = 0, coreColor = 0x00ffff, petalColor = 0x10b981): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: FlowerWellVertexShader,
    fragmentShader: FlowerWellFragmentShader,
    uniforms: {
      uTime: { value: 0.0 },
      uCoreColor: { value: new THREE.Color(coreColor) },
      uPetalColor: { value: new THREE.Color(petalColor) },
      uWellType: { value: wellType },
      uPulseIntensity: { value: 0.0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}
