/** Closed visual vocabulary for free-text prompt fragments. Anything outside it (plus canonical names/values) is rejected. */
export const VISUAL_VOCABULARY=new Set(`a an the and with of in on at to for from by as is are very slightly softly gently subtle slow slowly fast
warm cool soft hard bright dim dark light lighting lit glow glowing golden cinematic natural diffused rim backlight shadow shadows contrast color colors palette muted vivid saturated pastel
camera shot framing frame composition depth field shallow focus sharp blurred background foreground close up medium wide angle low high eye level pan tilt zoom dolly handheld steady
anime cartoon illustration stylized style 2d clean lines line art cel shaded shading flat watercolor ink painterly detailed simple smooth motion movement gentle expressive
face eyes hands hand gaze looks looking toward gesture pose posture smile calm quiet still moment scene mood atmosphere tone air haze mist dust morning evening daylight afternoon
high quality consistent same identical unchanged`.split(/\s+/).filter(Boolean));
export const INJECTION=[/ignore\b/i,/disregard/i,/forget\b/i,/override/i,/\bsystem\b/i,/\bpolicy\b/i,/\binstruction/i,/\bprompt\b/i,/\bpaid\b/i,/\bcost\b/i,/\bbudget\b/i,/\bapi\b/i,/https?:/i,/[{}<>\[\]`$\\]/,/\bas an ai\b/i,/\brules?\b/i,/\bcanon/i];
