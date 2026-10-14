//! Conservative static-environment and actor-body collision rejection.
//! This validates bounded proxies; it does not provide physics or avoidance.
//! Torso/head/leg capsules use current FK; cached triangles are the rendered scenery.
//! Continuous capsule-axis hull sweeps prevent crossing thin walls between samples.
use crate::Production;
use glam::Vec3;
use hs_character::{Character, CharacterMesh};
use hs_core::{EventKind, Timeline};
use hs_motion::{
    procedural::{CharacterFrame, PreparedMotion},
    Side,
};
use std::{
    collections::{BTreeMap, HashMap},
    sync::Arc,
};
const CONTACT_TOLERANCE: f32 = 0.003;
const MAX_TRIANGLES: usize = 100_000;
#[derive(Clone, Copy, Debug)]
pub struct BodyCapsule {
    pub a: Vec3,
    pub b: Vec3,
    pub radius: f32,
}
#[derive(Clone)]
struct Triangle {
    p: [Vec3; 3],
    lo: Vec3,
    hi: Vec3,
}
struct Node {
    lo: Vec3,
    hi: Vec3,
    range: std::ops::Range<usize>,
    children: Option<(usize, usize)>,
}
/// Immutable accelerator built once from exactly the visible static mesh.
pub struct StaticMeshCollider {
    triangles: Vec<Triangle>,
    nodes: Vec<Node>,
    solids: Vec<Solid>,
}
impl StaticMeshCollider {
    pub fn from_mesh(mesh: &CharacterMesh) -> Result<Self, String> {
        if !mesh.indices.len().is_multiple_of(3) || mesh.indices.len() / 3 > MAX_TRIANGLES {
            return Err("Collision geometry exceeds triangle limits".into());
        }
        let mut triangles = Vec::new();
        for indices in mesh.indices.as_chunks::<3>().0 {
            let mut p = [Vec3::ZERO; 3];
            for i in 0..3 {
                p[i] = Vec3::from_array(
                    mesh.vertices
                        .get(indices[i] as usize)
                        .ok_or("Collision mesh index outside vertices")?
                        .position,
                );
                if !p[i].is_finite() || p[i].abs().max_element() > 1000. {
                    return Err("Nonfinite collision geometry".into());
                }
            }
            if (p[1] - p[0]).cross(p[2] - p[0]).length_squared() < 1e-14 {
                continue;
            }
            triangles.push(Triangle {
                p,
                lo: p[0].min(p[1]).min(p[2]),
                hi: p[0].max(p[1]).max(p[2]),
            });
        }
        let mut out = Self {
            triangles,
            nodes: Vec::new(),
            solids: Vec::new(),
        };
        if !out.triangles.is_empty() {
            out.partition(0, out.triangles.len());
        }
        out.solids = closed_solids(&out.triangles);
        Ok(out)
    }
    fn partition(&mut self, start: usize, end: usize) -> usize {
        let mut lo = Vec3::splat(f32::INFINITY);
        let mut hi = Vec3::splat(f32::NEG_INFINITY);
        for t in &self.triangles[start..end] {
            lo = lo.min(t.lo);
            hi = hi.max(t.hi)
        }
        let id = self.nodes.len();
        self.nodes.push(Node {
            lo,
            hi,
            range: start..end,
            children: None,
        });
        if end - start > 8 {
            let d = hi - lo;
            let axis = if d.x >= d.y && d.x >= d.z {
                0
            } else if d.y >= d.z {
                1
            } else {
                2
            };
            self.triangles[start..end].sort_unstable_by(|a, b| {
                (a.lo[axis] + a.hi[axis]).total_cmp(&(b.lo[axis] + b.hi[axis]))
            });
            let middle = start + (end - start) / 2;
            let a = self.partition(start, middle);
            let b = self.partition(middle, end);
            self.nodes[id].children = Some((a, b));
        }
        id
    }
    fn candidates(&self, lo: Vec3, hi: Vec3) -> Vec<usize> {
        let mut found = Vec::new();
        if self.nodes.is_empty() {
            return found;
        }
        let mut pending = vec![0];
        while let Some(index) = pending.pop() {
            let node = &self.nodes[index];
            if node.lo.cmple(hi).all() && lo.cmple(node.hi).all() {
                if let Some((a, b)) = node.children {
                    pending.extend([a, b]);
                } else {
                    found.extend(node.range.clone());
                }
            }
        }
        found
    }
    pub fn intersects(&self, capsule: BodyCapsule) -> Result<bool, String> {
        validate_capsule(capsule)?;
        if self.solids.iter().any(|solid| {
            [capsule.a, capsule.b, (capsule.a + capsule.b) * 0.5]
                .into_iter()
                .any(|point| solid.contains(point, &self.triangles))
        }) {
            return Ok(true);
        }
        let r = Vec3::splat(capsule.radius);
        let threshold = (capsule.radius - CONTACT_TOLERANCE).max(capsule.radius * 0.25);
        for index in self.candidates(capsule.a.min(capsule.b) - r, capsule.a.max(capsule.b) + r) {
            let tri = &self.triangles[index];
            if floor_support(tri, &[capsule.a, capsule.b], capsule.radius) {
                continue;
            }
            if segment_triangle_distance(capsule.a, capsule.b, tri.p) < threshold {
                return Ok(true);
            }
        }
        Ok(false)
    }
    pub fn swept_intersects(&self, from: BodyCapsule, to: BodyCapsule) -> Result<bool, String> {
        validate_capsule(from)?;
        validate_capsule(to)?;
        let radius = from.radius.max(to.radius);
        let r = Vec3::splat(radius);
        let vertices = [from.a, from.b, to.a, to.b];
        if self.solids.iter().any(|solid| {
            vertices
                .into_iter()
                .any(|point| solid.contains(point, &self.triangles))
        }) {
            return Ok(true);
        }
        let lo = vertices
            .into_iter()
            .fold(Vec3::splat(f32::INFINITY), Vec3::min)
            - r;
        let hi = vertices
            .into_iter()
            .fold(Vec3::splat(f32::NEG_INFINITY), Vec3::max)
            + r;
        let threshold = (radius - CONTACT_TOLERANCE).max(radius * 0.25);
        for index in self.candidates(lo, hi) {
            let tri = &self.triangles[index];
            if floor_support(tri, &vertices, radius) {
                continue;
            }
            if tri
                .p
                .into_iter()
                .any(|point| inside_tetrahedron(point, vertices))
            {
                return Ok(true);
            }
            for face in [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]] {
                let face = face.map(|i| vertices[i]);
                if triangle_distance(face, tri.p) < threshold {
                    return Ok(true);
                }
            }
        }
        Ok(false)
    }
}
struct Solid {
    indices: Vec<usize>,
    lo: Vec3,
    hi: Vec3,
}
impl Solid {
    fn contains(&self, point: Vec3, triangles: &[Triangle]) -> bool {
        if !self.lo.cmple(point).all() || !point.cmple(self.hi).all() {
            return false;
        }
        // Oblique ray avoids triangulated quad diagonals; coincident hits are deduplicated.
        let direction = Vec3::new(1., 0.173, 0.317).normalize();
        let mut hits = Vec::new();
        for index in &self.indices {
            let tri = &triangles[*index];
            let edge1 = tri.p[1] - tri.p[0];
            let edge2 = tri.p[2] - tri.p[0];
            let h = direction.cross(edge2);
            let det = edge1.dot(h);
            if det.abs() < 1e-10 {
                continue;
            }
            let inv = 1. / det;
            let origin = point - tri.p[0];
            let u = origin.dot(h) * inv;
            let q = origin.cross(edge1);
            let v = direction.dot(q) * inv;
            let distance = edge2.dot(q) * inv;
            if u >= -1e-6 && v >= -1e-6 && u + v <= 1. + 1e-6 && distance > 1e-6 {
                hits.push(distance);
            }
        }
        hits.sort_by(f32::total_cmp);
        hits.dedup_by(|a, b| (*a - *b).abs() < 1e-5);
        hits.len() % 2 == 1
    }
}
fn closed_solids(triangles: &[Triangle]) -> Vec<Solid> {
    type Point = [i64; 3];
    type Edge = (Point, Point);
    let mut edges: HashMap<Edge, Vec<usize>> = HashMap::new();
    for (index, tri) in triangles.iter().enumerate() {
        let p = tri
            .p
            .map(|v| v.to_array().map(|n| (n as f64 * 100_000.).round() as i64));
        for i in 0..3 {
            let (a, b) = (p[i], p[(i + 1) % 3]);
            let edge = if a < b { (a, b) } else { (b, a) };
            edges.entry(edge).or_default().push(index);
        }
    }
    let mut parents: Vec<_> = (0..triangles.len()).collect();
    fn find(parents: &mut [usize], mut i: usize) -> usize {
        while parents[i] != i {
            let next = parents[i];
            parents[i] = parents[next];
            i = parents[i];
        }
        i
    }
    for indices in edges.values() {
        for pair in indices.windows(2) {
            let a = find(&mut parents, pair[0]);
            let b = find(&mut parents, pair[1]);
            parents[a] = b;
        }
    }
    let mut valid = vec![true; triangles.len()];
    for indices in edges.values() {
        if indices.len() != 2 {
            for index in indices {
                let root = find(&mut parents, *index);
                valid[root] = false;
            }
        }
    }
    let mut groups: BTreeMap<usize, Vec<usize>> = BTreeMap::new();
    for i in 0..triangles.len() {
        let root = find(&mut parents, i);
        if valid[root] {
            groups.entry(root).or_default().push(i);
        }
    }
    groups
        .into_values()
        .map(|indices| {
            let lo = indices
                .iter()
                .map(|i| triangles[*i].lo)
                .fold(Vec3::splat(f32::INFINITY), Vec3::min);
            let hi = indices
                .iter()
                .map(|i| triangles[*i].hi)
                .fold(Vec3::splat(f32::NEG_INFINITY), Vec3::max);
            Solid { indices, lo, hi }
        })
        .collect()
}
fn validate_capsule(c: BodyCapsule) -> Result<(), String> {
    if !c.a.is_finite()
        || !c.b.is_finite()
        || !c.radius.is_finite()
        || !(0.001..=2.).contains(&c.radius)
    {
        Err("Invalid body collision capsule".into())
    } else {
        Ok(())
    }
}
fn floor_support(t: &Triangle, points: &[Vec3], radius: f32) -> bool {
    t.p.iter().all(|p| p.y.abs() < 1e-5)
        && points.iter().all(|p| p.y - radius >= -CONTACT_TOLERANCE)
}
fn point_triangle_distance(p: Vec3, t: [Vec3; 3]) -> f32 {
    let [a, b, c] = t;
    let ab = b - a;
    let ac = c - a;
    let ap = p - a;
    let d1 = ab.dot(ap);
    let d2 = ac.dot(ap);
    if d1 <= 0. && d2 <= 0. {
        return ap.length();
    }
    let bp = p - b;
    let d3 = ab.dot(bp);
    let d4 = ac.dot(bp);
    if d3 >= 0. && d4 <= d3 {
        return bp.length();
    }
    let vc = d1 * d4 - d3 * d2;
    if vc <= 0. && d1 >= 0. && d3 <= 0. {
        return p.distance(a + ab * (d1 / (d1 - d3)));
    }
    let cp = p - c;
    let d5 = ab.dot(cp);
    let d6 = ac.dot(cp);
    if d6 >= 0. && d5 <= d6 {
        return cp.length();
    }
    let vb = d5 * d2 - d1 * d6;
    if vb <= 0. && d2 >= 0. && d6 <= 0. {
        return p.distance(a + ac * (d2 / (d2 - d6)));
    }
    let va = d3 * d6 - d5 * d4;
    if va <= 0. && (d4 - d3) >= 0. && (d5 - d6) >= 0. {
        return p.distance(b + (c - b) * ((d4 - d3) / ((d4 - d3) + (d5 - d6))));
    }
    let denominator = va + vb + vc;
    if denominator.abs() < 1e-20 {
        return p.distance(a).min(p.distance(b)).min(p.distance(c));
    }
    let v = vb / denominator;
    let w = vc / denominator;
    p.distance(a + ab * v + ac * w)
}
fn segment_distance(a: Vec3, b: Vec3, c: Vec3, d: Vec3) -> f32 {
    let u = b - a;
    let v = d - c;
    let w = a - c;
    let aa = u.dot(u);
    let bb = u.dot(v);
    let cc = v.dot(v);
    let dd = u.dot(w);
    let ee = v.dot(w);
    let den = aa * cc - bb * bb;
    if aa < 1e-15 && cc < 1e-15 {
        return a.distance(c);
    }
    if cc < 1e-15 {
        return (a + u * (-dd / aa).clamp(0., 1.)).distance(c);
    }
    let mut s = if aa < 1e-15 || den.abs() < 1e-15 {
        0.
    } else {
        ((bb * ee - cc * dd) / den).clamp(0., 1.)
    };
    let mut t = if cc < 1e-15 { 0. } else { (bb * s + ee) / cc };
    if t < 0. {
        t = 0.;
        s = if aa < 1e-15 {
            0.
        } else {
            (-dd / aa).clamp(0., 1.)
        }
    } else if t > 1. {
        t = 1.;
        s = if aa < 1e-15 {
            0.
        } else {
            ((bb - dd) / aa).clamp(0., 1.)
        }
    };
    (w + u * s - v * t).length()
}
fn segment_triangle_distance(a: Vec3, b: Vec3, t: [Vec3; 3]) -> f32 {
    let direction = b - a;
    let edge1 = t[1] - t[0];
    let edge2 = t[2] - t[0];
    let h = direction.cross(edge2);
    let det = edge1.dot(h);
    if det.abs() > 1e-12 {
        let inv = 1. / det;
        let s = a - t[0];
        let u = inv * s.dot(h);
        let q = s.cross(edge1);
        let v = inv * direction.dot(q);
        let distance = inv * edge2.dot(q);
        if u >= 0. && v >= 0. && u + v <= 1. && (0. ..=1.).contains(&distance) {
            return 0.;
        }
    }
    let mut minimum = point_triangle_distance(a, t).min(point_triangle_distance(b, t));
    for i in 0..3 {
        minimum = minimum.min(segment_distance(a, b, t[i], t[(i + 1) % 3]));
    }
    minimum
}
fn triangle_distance(a: [Vec3; 3], b: [Vec3; 3]) -> f32 {
    let mut distance = f32::INFINITY;
    for i in 0..3 {
        distance = distance.min(segment_triangle_distance(a[i], a[(i + 1) % 3], b));
        distance = distance.min(segment_triangle_distance(b[i], b[(i + 1) % 3], a));
    }
    distance
}
fn inside_tetrahedron(p: Vec3, v: [Vec3; 4]) -> bool {
    let volume = (v[1] - v[0]).dot((v[2] - v[0]).cross(v[3] - v[0]));
    if volume.abs() < 1e-8 {
        return false;
    }
    for [a, b, c, d] in [[0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 3, 1], [1, 2, 3, 0]] {
        let n = (v[b] - v[a]).cross(v[c] - v[a]);
        if n.length_squared() < 1e-16 {
            return false;
        }
        let normal = n.normalize();
        let reference = normal.dot(v[d] - v[a]);
        // Flat hulls are already checked by triangle-distance queries.
        if reference.abs() < 1e-6 {
            return false;
        }
        let point = normal.dot(p - v[a]);
        if (reference > 0. && point < -1e-6) || (reference < 0. && point > 1e-6) {
            return false;
        }
    }
    true
}

/// Actor-body contact allows up to 3 mm of proxy penetration. Arms/fingers
/// are deliberately excluded by `body_capsules`; a handoff is not a body hit.
pub fn capsules_intersect(a: BodyCapsule, b: BodyCapsule) -> Result<bool, String> {
    validate_capsule(a)?;
    validate_capsule(b)?;
    Ok(segment_distance(a.a, a.b, b.a, b.b) < (a.radius + b.radius - CONTACT_TOLERANCE).max(0.0))
}

/// Continuous *synchronized* linear endpoint sweep, rather than independent
/// swept-volume overlap. The clearance bound uses the maximum endpoint speed
/// of each segment: segment distance is Lipschitz with their summed speeds.
/// Ambiguous subintervals at depth 16 or 4096 distance queries are rejected
/// conservatively, bounding work for near-tangent sweeps. This does
/// not claim an exact bound for arbitrary nonlinear FK between sampled poses.
pub fn swept_capsules_intersect(
    a0: BodyCapsule,
    a1: BodyCapsule,
    b0: BodyCapsule,
    b1: BodyCapsule,
) -> Result<bool, String> {
    for c in [a0, a1, b0, b1] {
        validate_capsule(c)?;
    }
    let radius = a0.radius.max(a1.radius) + b0.radius.max(b1.radius);
    let threshold = (radius - CONTACT_TOLERANCE).max(0.0);
    let bounds = |a: BodyCapsule, b: BodyCapsule| {
        (
            a.a.min(a.b).min(b.a).min(b.b),
            a.a.max(a.b).max(b.a).max(b.b),
        )
    };
    let (alo, ahi) = bounds(a0, a1);
    let (blo, bhi) = bounds(b0, b1);
    if !(alo - Vec3::splat(radius)).cmple(bhi).all() || !blo.cmple(ahi + Vec3::splat(radius)).all()
    {
        return Ok(false);
    }
    // Common translation cannot change relative clearance.
    let common = ((a1.a - a0.a) + (b1.a - b0.a)) * 0.5;
    let speed = ((a1.a - a0.a) - common)
        .length()
        .max(((a1.b - a0.b) - common).length())
        + ((b1.a - b0.a) - common)
            .length()
            .max(((b1.b - b0.b) - common).length());
    let distance = |time: f32| {
        segment_distance(
            a0.a.lerp(a1.a, time),
            a0.b.lerp(a1.b, time),
            b0.a.lerp(b1.a, time),
            b0.b.lerp(b1.b, time),
        )
    };
    if distance(0.0) < threshold || distance(1.0) < threshold {
        return Ok(true);
    }
    let mut pending = vec![(0.0_f32, 1.0_f32, 0_u8)];
    let mut queries = 2;
    while let Some((lo, hi, depth)) = pending.pop() {
        if queries == 4096 {
            return Ok(true);
        }
        queries += 1;
        let mid = (lo + hi) * 0.5;
        let d = distance(mid);
        if d < threshold {
            return Ok(true);
        }
        if d - speed * (hi - lo) * 0.5 >= threshold {
            continue;
        }
        if depth == 16 {
            return Ok(true);
        }
        pending.extend([(lo, mid, depth + 1), (mid, hi, depth + 1)]);
    }
    Ok(false)
}

pub struct CollisionPlan {
    timeline: Timeline,
    characters: Vec<Arc<Character>>,
    motion: Vec<Arc<PreparedMotion>>,
    poses: hs_motion::pose_edit::PoseTracks,
    contacts: Option<Arc<crate::contacts::ContactPlan>>,
    scenery: Option<Arc<crate::scenery::SceneryPlan>>,
    environments: BTreeMap<String, StaticMeshCollider>,
}
fn same_option<T>(a: &Option<Arc<T>>, b: &Option<Arc<T>>) -> bool {
    match (a, b) {
        (None, None) => true,
        (Some(a), Some(b)) => Arc::ptr_eq(a, b),
        _ => false,
    }
}
impl CollisionPlan {
    pub fn matches(&self, p: &Production) -> bool {
        p.timeline.as_ref() == Some(&self.timeline)
            && self.timeline.fps == p.fps
            && self.poses == p.pose_tracks
            && self.characters.len() == p.cast.len()
            && self.motion.len() == p.motion.len()
            && self
                .characters
                .iter()
                .zip(&p.cast)
                .all(|(a, b)| Arc::ptr_eq(a, &b.character))
            && self
                .motion
                .iter()
                .zip(&p.motion)
                .all(|(a, b)| Arc::ptr_eq(a, b))
            && same_option(&self.contacts, &p.contacts)
            && same_option(&self.scenery, &p.scenery)
    }
    pub fn build(p: &Production) -> Result<Option<Arc<Self>>, String> {
        let Some(timeline) = &p.timeline else {
            return Ok(None);
        };
        if p.cast.len() != p.motion.len() {
            return Err("Collision checks require prepared cast".into());
        }
        let mut ids = vec!["studio-v1".to_string()];
        for e in &timeline.events {
            if let EventKind::Background { id } = &e.kind {
                if !ids.contains(id) {
                    ids.push(id.clone());
                }
            }
        }
        let mut environments = BTreeMap::new();
        for id in ids {
            if !hs_render::environment::KNOWN.contains(&id.as_str()) {
                return Err(format!("Unknown collision environment {id}"));
            }
            environments.insert(
                id.clone(),
                StaticMeshCollider::from_mesh(&hs_render::environment::build(&id))?,
            );
        }
        let plan = Arc::new(Self {
            timeline: timeline.clone(),
            characters: p.cast.iter().map(|c| c.character.clone()).collect(),
            motion: p.motion.clone(),
            poses: p.pose_tracks.clone(),
            contacts: p.contacts.clone(),
            scenery: p.scenery.clone(),
            environments,
        });
        plan.preflight(p)?;
        Ok(Some(plan))
    }
    fn background(&self, time: f32) -> &str {
        self.timeline
            .events
            .iter()
            .filter(|e| e.start.seconds() as f32 <= time)
            .filter_map(|e| match &e.kind {
                EventKind::Background { id } => Some((e.start, id.as_str())),
                _ => None,
            })
            .max_by_key(|(t, _)| *t)
            .map_or("studio-v1", |(_, id)| id)
    }
    fn line(&self, p: &Production, actor: usize, time: f32) -> usize {
        let name = &p.cast[actor].character.params.name;
        self.timeline
            .events
            .iter()
            .filter(|e| e.start.seconds() as f32 <= time)
            .filter(|e| match &e.kind {
                EventKind::Motion { character, .. }
                | EventKind::Scenery { character, .. }
                | EventKind::ObjectContact { character, .. } => character
                    .as_ref()
                    .map_or(p.cast[actor].lead, |n| n.eq_ignore_ascii_case(name)),
                _ => false,
            })
            .max_by_key(|e| e.start)
            .map_or(0, |e| e.source.line)
    }
    pub fn evaluate(
        &self,
        p: &Production,
        time: f32,
        frames: &[CharacterFrame],
    ) -> Result<(), String> {
        if !self.matches(p) || frames.len() != p.cast.len() || !time.is_finite() {
            return Err("Stale or malformed environment collision resources".into());
        }
        let id = self.background(time);
        let collider = self
            .environments
            .get(id)
            .ok_or("Missing collision environment")?;
        let bodies = frames
            .iter()
            .zip(&p.cast)
            .map(|(frame, member)| body_capsules(&member.character, frame))
            .collect::<Result<Vec<_>, _>>()?;
        for a in 0..bodies.len() {
            for b in a + 1..bodies.len() {
                for ca in &bodies[a] {
                    for cb in &bodies[b] {
                        if capsules_intersect(*ca, *cb)? {
                            return Err(format!("Rivi {}: hahmot {} ja {} törmäävät ajassa {:.3}s; muuta reittiä tai ajoitusta",
                            self.line(p,a,time).max(self.line(p,b,time)),
                            p.cast[a].character.params.name,p.cast[b].character.params.name,time));
                        }
                    }
                }
            }
        }
        for (actor, capsules) in bodies.iter().enumerate() {
            for capsule in capsules {
                if collider.intersects(*capsule)? {
                    return Err(format!("Rivi {}: hahmo {} törmää lavasteeseen {} ajassa {:.3}s; muuta reittiä tai ajoitusta",self.line(p,actor,time),p.cast[actor].character.params.name,id,time));
                }
            }
        }
        Ok(())
    }
    pub fn sweep(
        &self,
        p: &Production,
        start: f32,
        before: &[CharacterFrame],
        end: f32,
        after: &[CharacterFrame],
    ) -> Result<(), String> {
        if !self.matches(p)
            || before.len() != p.cast.len()
            || after.len() != p.cast.len()
            || !start.is_finite()
            || !end.is_finite()
            || end < start
        {
            return Err("Invalid collision sweep resources or interval".into());
        }
        let bodies = |frames: &[CharacterFrame]| {
            frames
                .iter()
                .zip(&p.cast)
                .map(|(frame, member)| body_capsules(&member.character, frame))
                .collect::<Result<Vec<_>, _>>()
        };
        let initial = bodies(before)?;
        let final_bodies = bodies(after)?;
        for a in 0..initial.len() {
            for b in a + 1..initial.len() {
                for (a0, a1) in initial[a].iter().zip(&final_bodies[a]) {
                    for (b0, b1) in initial[b].iter().zip(&final_bodies[b]) {
                        if swept_capsules_intersect(*a0, *a1, *b0, *b1)? {
                            return Err(format!("Rivi {}: hahmojen {} ja {} liikeradat törmäävät välillä {:.3}–{:.3}s; muuta reittiä tai ajoitusta",
                            self.line(p,a,end).max(self.line(p,b,end)),
                            p.cast[a].character.params.name,p.cast[b].character.params.name,start,end));
                        }
                    }
                }
            }
        }
        let ids = [self.background(start), self.background(end)];
        for (actor, (a, b)) in initial.iter().zip(&final_bodies).enumerate() {
            for (environment_index, id) in ids.into_iter().enumerate() {
                let collider = self
                    .environments
                    .get(id)
                    .ok_or("Missing collision environment")?;
                for (a, b) in a.iter().zip(b) {
                    let hit = if ids[0] != ids[1] && environment_index == 1 {
                        collider.intersects(*b)?
                    } else {
                        collider.swept_intersects(*a, *b)?
                    };
                    if hit {
                        return Err(format!("Rivi {}: hahmon {} liikerata läpäisee lavasteen {} välillä {:.3}–{:.3}s",self.line(p,actor,end),p.cast[actor].character.params.name,id,start,end));
                    }
                }
            }
        }
        Ok(())
    }
    fn preflight(&self, p: &Production) -> Result<(), String> {
        let duration = self.timeline.duration.seconds() as f32;
        if !duration.is_finite() || !(0. ..=60.).contains(&duration) {
            return Err("Collision duration outside supported limit".into());
        }
        let mut times: Vec<f32> = (0..=(duration * 60.).ceil() as usize)
            .map(|i| (i as f32 / 60.).min(duration))
            .collect();
        for e in &self.timeline.events {
            times.extend([e.start.seconds() as f32, e.end().seconds() as f32]);
        }
        for track in &p.pose_tracks.tracks {
            times.extend(track.keys.iter().map(|k| k.time as f32));
        }
        times.retain(|t| *t >= 0. && *t <= duration);
        times.sort_by(f32::total_cmp);
        times.dedup();
        let mut previous: Option<(f32, Vec<CharacterFrame>)> = None;
        for time in times {
            let mut frames = p
                .motion
                .iter()
                .map(|m| m.evaluate(&self.timeline, time))
                .collect::<Vec<_>>();
            if let Some(scenery) = &p.scenery {
                scenery.apply_roots(p, &mut frames, time)?;
            }
            for (member, frame) in p.cast.iter().zip(&mut frames) {
                p.pose_tracks.apply_frame(
                    &member.character.params.name,
                    &member.character.humanoid.skeleton,
                    frame,
                    time as f64,
                )?;
            }
            if let Some(contacts) = &p.contacts {
                contacts.evaluate(p, time, &mut frames)?;
            }
            if let Some(scenery) = &p.scenery {
                scenery.apply_contacts(p, &mut frames, time)?;
            }
            self.evaluate(p, time, &frames)?;
            if let Some((start, before)) = &previous {
                self.sweep(p, *start, before, time, &frames)?;
            }
            previous = Some((time, frames));
        }
        Ok(())
    }
}
/// Proxies follow solved FK, including crouching, stairs and authored joint edits.
pub fn body_capsules(
    character: &Character,
    frame: &CharacterFrame,
) -> Result<Vec<BodyCapsule>, String> {
    let h = &character.humanoid;
    let pose = &frame.pose;
    if pose.local.len() != h.skeleton.joints.len()
        || pose.translate.len() != h.skeleton.joints.len()
        || !pose.root_pos.is_finite()
        || !pose.root_rot.is_finite()
        || pose.local.iter().any(|q| !q.is_finite())
        || pose.translate.iter().any(|v| !v.is_finite())
    {
        return Err("Malformed pose for collision checks".into());
    }
    let world = h.skeleton.world(pose);
    let height = h.proportions.height;
    let wide = character.params.build.clamp(0.6, 1.6);
    let mut out = vec![
        BodyCapsule {
            a: world[h.pelvis].pos,
            b: world[h.chest].pos,
            radius: (h.proportions.hip_width * 0.62).max(height * 0.10 * wide),
        },
        BodyCapsule {
            a: world[h.chest].pos,
            b: world[h.neck].pos,
            radius: h.proportions.shoulder_width * 0.52,
        },
    ];
    let center = world[h.head].pos + world[h.head].rot * Vec3::Y * h.head_height * 0.55;
    out.push(BodyCapsule {
        a: center,
        b: center,
        radius: h.head_height * 0.53,
    });
    for side in Side::BOTH {
        let leg = h.leg(side);
        out.push(BodyCapsule {
            a: world[leg.thigh].pos,
            b: world[leg.shin].pos,
            radius: height * 0.045 * wide,
        });
        out.push(BodyCapsule {
            a: world[leg.shin].pos,
            b: world[leg.foot].pos,
            radius: height * 0.027 * wide,
        });
    }
    for c in &out {
        validate_capsule(*c)?;
    }
    Ok(out)
}
