// Hahmostudion varjostin. Sama malli kuin src/shading.rs (CPU-polku).

struct Globals {
    view_proj: mat4x4<f32>,
    eye: vec4<f32>,
    key_dir: vec4<f32>,
    key_col: vec4<f32>,
    fill_dir: vec4<f32>,
    fill_col: vec4<f32>,
    rim_dir: vec4<f32>,
    rim_col: vec4<f32>,
    ambient: vec4<f32>,
    // x = tyyli (0 flat, 1 cel)
    style: vec4<f32>,
};

struct Bones {
    m: array<mat4x4<f32>, 64>,
};

@group(0) @binding(0) var<uniform> g: Globals;
@group(1) @binding(0) var<uniform> bones: Bones;

struct VIn {
    @location(0) pos: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) color: vec4<f32>,
    @location(3) bone: vec2<u32>,
    @location(4) weight: f32,
    @location(5) shade: f32,
};

struct VOut {
    @builtin(position) clip: vec4<f32>,
    @location(0) world: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) color: vec3<f32>,
    @location(3) shade: f32,
};

@vertex
fn vs_main(v: VIn) -> VOut {
    let ma = bones.m[v.bone.x];
    let mb = bones.m[v.bone.y];
    let p = vec4<f32>(v.pos, 1.0);
    let n = vec4<f32>(v.normal, 0.0);
    let world = (ma * p) * v.weight + (mb * p) * (1.0 - v.weight);
    let normal = (ma * n) * v.weight + (mb * n) * (1.0 - v.weight);
    var o: VOut;
    o.clip = g.view_proj * vec4<f32>(world.xyz, 1.0);
    o.world = world.xyz;
    o.normal = normal.xyz;
    o.color = v.color.rgb;
    o.shade = v.shade;
    return o;
}

fn safe_normalize(v: vec3<f32>) -> vec3<f32> {
    let l = length(v);
    if (l < 1e-8) {
        return vec3<f32>(0.0);
    }
    return v / l;
}

@fragment
fn fs_main(i: VOut) -> @location(0) vec4<f32> {
    let n = safe_normalize(i.normal);
    let v = safe_normalize(g.eye.xyz - i.world);
    var k = max(dot(n, -g.key_dir.xyz), 0.0);
    var f = max(dot(n, -g.fill_dir.xyz), 0.0);
    let facing = max(dot(n, v), 0.0);
    var rim = pow(1.0 - facing, 3.0) * (dot(n, -g.rim_dir.xyz) * 0.5 + 0.5);
    let cel = g.style.x > 0.5;
    if (cel) {
        k = select(select(0.3, 0.6, k > 0.18), 1.0, k > 0.5);
        f = select(0.35, 0.8, f > 0.3);
        rim = select(0.0, 1.0, rim > 0.35);
    }
    if (i.shade < 0.9) {
        rim = 0.0;
    }
    var lit = g.ambient.xyz + g.key_col.xyz * k + g.fill_col.xyz * f;
    if (!cel) {
        lit = mix(vec3<f32>(1.0), lit, 0.3);
    }
    let rim_amount = select(0.15, 0.35, cel);
    let lit_color = i.color * lit + g.rim_col.xyz * rim * rim_amount;
    let unlit = i.color * (0.92 + 0.08 * k);
    let c = mix(unlit, lit_color, clamp(i.shade, 0.0, 1.0));
    return vec4<f32>(clamp(c, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}
