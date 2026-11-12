// The boss's vocabulary, and the comic words that pop off hits.
export const pick = (arr) => arr[(Math.random() * arr.length) | 0]

export const TAUNTS = [
  'Per my last email…',
  "Let's circle back on that.",
  'Can you hop on a quick call?',
  "We're a family here.",
  'Quick sync at 5:55 pm?',
  'This should only take 5 minutes.',
  'Any updates?',
  "Great question! Let's park it.",
  "Let's leverage our bandwidth.",
  'New deadline: yesterday.',
  'Thoughts?',
  "Let's put a pin in that.",
  'Who moved my stapler?',
  'Can you work this weekend?',
  'Just a friendly reminder…',
  "Let's touch base offline.",
  "I'll need that by EOD.",
  "Let's align on the alignment.",
]

export const OUCH = [
  'Noted!',
  "Ow! That's out of scope!",
  'HR will hear about this!',
  "Let's escalate!",
  'Not my KPIs!',
  'Is this a 1:1?',
  "That's not agile!",
  'My quarterly bonus!',
  "OK, OK — 4-day week!",
  "I'll approve your PTO!",
  'Raise! You get a raise!',
  'Ow! Mondays, man…',
  'Let me loop in legal!',
  "That's not a team player move!",
]

export const PROP_LINES = {
  mug: ['My coffee!!', 'That was oat milk!', 'Decaf?! Who did this?'],
  stamp: ['DENIED?! Me?!', "You can't reject ME!", 'Stamped by an intern!'],
  stapler: ["Hey, that's MY stapler!", 'Staple this to the minutes!'],
  paper: ['Is that the Q3 report?', 'Recycle that, please.'],
  pie: ['Mmm… lemon?', "I'm allergic to fun!", 'Is this… team building?'],
  keyboard: ['Ctrl+Z! CTRL+Z!', 'Did you just Alt+F4 me?', 'My keyboard shortcuts!'],
  chair: ["That's ergonomic!", 'Not the Herman Miller!'],
  nose: ['HONK. I mean — ow.', "That's my good nose!"],
  haymaker: ['I felt that in my 401k!', 'Ok that one HURT.', 'Was that in the budget?!'],
}

export const MOOD_LINES = {
  dizzy: ['Who scheduled… this meeting…', 'I see… synergies…', 'Is it Friday yet…'],
  defeated: ["I'll… schedule a follow-up…", 'Fine. Take the afternoon off.', 'Can we… reschedule…'],
}

export const TIERS = [
  { name: 'Mildly irritated', color: '#ffd166' },
  { name: 'Annoyed', color: '#ffb347', line: "Let's not escalate…" },
  { name: 'Furious', color: '#ff7a3d', line: 'Can we discuss this calmly?' },
  { name: 'LIVID', color: '#ff3d3d', line: "I'm calling IT!" },
  { name: 'MELTDOWN', color: '#f15bb5' },
]

export const REACT_LINES = {
  miss: ['Ha! Missed me!', 'Swing and a miss!', 'Is that all you got?', 'You call that a punch?', 'Nice try!', 'Too slow!'],
  scared: ['W-wait! Let’s talk!', 'Is this about the reorg?', 'I’ll approve your leave!', 'Not the face!', 'Let’s take this offline!'],
  angry: ['Why I oughta…', 'That’s it! Mandatory overtime!', 'My office. NOW!', 'You’re on thin ice!', 'Grrr… synergy!'],
  gross: ['Eww!', 'Is that… gluten?!', 'Not on the suit!', 'Bleh!'],
  sleepy: ['*yawn* …anyway…', 'Zzz… synergy… zzz…', 'Is it lunch yet?'],
  wake: ['Huh?! I’m awake!', 'I was resting my eyes!', 'Who said meeting?!'],
  cry: ['Waaah! My KPIs!', 'I just wanted… engagement…', 'Not the bonus! *sob*'],
}

export const MORNING = ['Good morning, team!', "New day, new deliverables!", 'Did everyone see my email?']

export const WORDS = {
  punch: ['POW!', 'BAM!', 'WHAM!', 'OOF!'],
  bonk: ['BONK!', 'KLONK!', 'DOINK!'],
  slap: ['THWACK!', 'SMACK!', 'SLAP!'],
  haymaker: ['KA-POW!', 'KA-BOOM!', 'WHAMMO!'],
  nose: ['HONK!'],
  paper: ['FWAP!'],
  stapler: ['CLANK!'],
  mug: ['SMASH!', 'CRASH!'],
  stamp: ['DENIED!'],
  pie: ['SPLAT!'],
  keyboard: ['CLACK!', 'ALT+F4!'],
  chair: ['KER-RASH!', 'CRASH!'],
}

export const VERDICTS = ['Needs improvement', 'Does not meet expectations', 'Placed on a PIP', 'Please see HR', 'Reassigned to the basement']
