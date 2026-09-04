import * as THREE from 'three';

/**
 * GLSL Fresnel Nature Energy & Steam Shield Shader
 * Renders an animated, pulsating iridescent sphere with rim lighting,
 * electric nature arcs, and steam vapor noise.
 */
export const ShieldVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const ShieldFragmentShader = `
  uniform float uTime;
  uniform vec3 uBaseColor;
  uniform vec3 uGlowColor;
  uniform float uShieldIntensity;
  uniform float uSteamTurbulence;

  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  // Simplex-style pseudo noise
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    if (uShieldIntensity <= 0.01) {
      discard;
    }

    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    // Fresnel Rim Glow
    float fresnel = 1.0 - max(dot(viewDir, normal), 0.0);
    fresnel = pow(fresnel, 2.5);

    // Steam Vapor Flow Noise
    vec2 flowUv1 = vUv * 6.0 + vec2(uTime * 0.4, uTime * 0.2);
    vec2 flowUv2 = vUv * 10.0 - vec2(uTime * 0.3, uTime * 0.5);
    float n1 = noise(flowUv1);
    float n2 = noise(flowUv2);
    float steamNoise = (n1 + n2) * 0.5;

    // Nature Energy Pulse Waves
    float pulse = sin(vWorldPosition.y * 5.0 - uTime * 6.0) * 0.5 + 0.5;
    float rings = sin(length(vWorldPosition.xz) * 8.0 - uTime * 4.0) * 0.5 + 0.5;

    // Hexagonal / Lattice Steampunk runic grid
    vec2 gridUv = fract(vUv * 16.0) - 0.5;
    float grid = step(0.42, max(abs(gridUv.x), abs(gridUv.y)));

    // Combined color composition
    vec3 color = mix(uBaseColor, uGlowColor, fresnel * 1.5 + steamNoise * 0.4);
    color += uGlowColor * pulse * 0.3;
    color += vec3(0.1, 0.8, 0.6) * rings * 0.25;
    color += vec3(0.9, 0.7, 0.2) * grid * 0.2; // Steampunk brass energy grid

    float alpha = (fresnel * 0.85 + steamNoise * 0.25 + grid * 0.15 + pulse * 0.1) * uShieldIntensity;
    alpha = clamp(alpha, 0.0, 0.95);

    gl_FragColor = vec4(color, alpha);
  }
`;

export function createShieldMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: ShieldVertexShader,
    fragmentShader: ShieldFragmentShader,
    uniforms: {
      uTime: { value: 0.0 },
      uBaseColor: { value: new THREE.Color(0x00e5ff) }, // Cyan Steam
      uGlowColor: { value: new THREE.Color(0x10b981) }, // Emerald Nature Energy
      uShieldIntensity: { value: 0.0 },
      uSteamTurbulence: { value: 1.0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}
