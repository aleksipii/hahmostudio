//! Proseduraalinen animaatio ilman käsin tehtyjä avainruutuja.
//!
//! * [`skeleton`]: nivelhierarkia ja eteenpäin kinematiikka (FK).
//! * [`humanoid`]: parametrinen ihmisluuranko 5-sormisine käsineen.
//! * [`ik`]: analyyttinen kahden luun IK napavektorilla ja sarana-/kartiorajoitettu CCD sormille.
//! * [`gait`]: kävely- ja juoksusykli (jalat, lantion pomppu, olkapäiden vastakierto).
//! * [`secondary`]: vaimentuvat siniaallot hiuksille ja vaatteille.
//! * [`face`]: suun visemirigi (huulisynkka).
//! * [`hands`]: otteet ja puhelimen näpyttely peukaloilla.
//! * [`procedural`]: yhdistää kaiken aikajanan tapahtumista tilattomaksi funktioksi `t -> asento`.
//!
//! Kaikki on deterministiä ja tilatonta: minkä tahansa ruudun voi laskea
//! suoraan, joten aikajanan selaus ja rinnakkainen vienti tuottavat saman tuloksen.

pub mod acting_style;
pub mod expression;
pub mod face;
pub mod gait;
pub mod gestures;
pub mod hands;
pub mod humanoid;
pub mod ik;
pub mod procedural;
pub mod seating;
pub mod secondary;
pub mod skeleton;

pub use humanoid::{Humanoid, MouthRig, Proportions, Side};
pub use procedural::{CharacterFrame, ProceduralMotion, PropFrame};
pub use skeleton::{Joint, JointWorld, Pose, Skeleton};

pub mod scenery;

pub mod pose_edit;

pub mod layers;
