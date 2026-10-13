use hs_agents::{Pipeline, Production};
use hs_motion::Side;
fn ready(source: &str) -> Production {
    let mut p = Production::new(source);
    Pipeline::default().run(&mut p).unwrap(); p
}
#[test]
fn speech_gesture_yields_to_authored_actions_and_carried_objects() {
    let free = ready("KALLE: Hello there. [wait 3s]");
    let held = ready("KALLE: Hello there. [prop coffee cup] [wait 3s]");
    let arm = free.cast[0].character.humanoid.arm(Side::Right);
    let sample = |p: &Production, t: f32| p.motion[0].evaluate(p.timeline.as_ref().unwrap(), t).pose;
    assert!(sample(&free, 0.8).local[arm.upper].angle_between(sample(&held, 0.8).local[arm.upper]) > 0.03);
    assert!(sample(&free, 0.0).local[arm.upper].angle_between(sample(&held, 0.0).local[arm.upper]) < 0.001);
    let wave = ready("KALLE: Hello there. [wave 3s]");
    let wave_held = ready("KALLE: Hello there. [prop coffee cup] [wave 3s]");
    assert!(sample(&wave, 0.8).local[arm.upper].angle_between(sample(&wave_held, 0.8).local[arm.upper]) < 0.001);
}
