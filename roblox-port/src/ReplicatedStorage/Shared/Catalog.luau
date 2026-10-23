-- EXOTIC catalog ported to Luau
local Catalog = {}

Catalog.SHOP_ITEMS = {
  {id="skin:solid",category="skin",name="SLAB",blurb="The default. Dense, honest, doomed.",price=0,consumable=false},
  {id="skin:hollow",category="skin",name="HOLLOW",blurb="An empty box. Like your confidence.",price=160,consumable=false},
  {id="skin:diagonal",category="skin",name="WEDGE",blurb="Split personality, 45 degrees.",price=200,consumable=false},
  {id="skin:checker",category="skin",name="CHECKER",blurb="Four pixels of pure stability.",price=240,consumable=false},
  {id="skin:ghost",category="skin",name="PHANTOM",blurb="Half-here. Fully breakable.",price=320,consumable=false},
  {id="trail:none",category="trail",name="BARE",blurb="No trail. Leave no trace.",price=0,consumable=false},
  {id="trail:pixels",category="trail",name="PIXELRAIN",blurb="Shed tiny squares while sprinting.",price=180,consumable=false},
  {id="trail:comet",category="trail",name="COMET",blurb="A shrinking tail of speed.",price=220,consumable=false},
  {id="trail:shadow",category="trail",name="AFTERIMAGE",blurb="Your past selves, lagging behind.",price=300,consumable=false},
  {id="gear:reveal",category="gear",name="TRAP-SCOPE",blurb="Every trap is invisible until it springs. This flashes them all for 2 seconds.",price=70,consumable=true},
  {id="gear:pass",category="gear",name="ANCHOR",blurb="Drop one extra checkpoint, anywhere, mid-run.",price=130,consumable=true},
  {id="gear:skip",category="gear",name="SKIP TOKEN",blurb="Permanently unlock the level after your current one.",price=400,consumable=true},
  {id="taunt:classic",category="taunt",name="CLASSIC RAGE",blurb="The original verbal slap.",price=0,consumable=false},
  {id="taunt:corporate",category="taunt",name="CORPORATE",blurb="Deaths, now with HR-approved feedback.",price=140,consumable=false},
  {id="taunt:poetic",category="taunt",name="POETIC",blurb="Every fall, a tiny tragedy.",price=200,consumable=false},
  {id="taunt:minimal",category="taunt",name="MINIMAL",blurb="No words. Just judgment.",price=120,consumable=false},
}

Catalog.TAUNTS = {
  classic = {"AGAIN.","THE FLOOR LIED. YOU BELIEVED.","YOU WALKED INTO THAT ONE.","SKILL ISSUE NOT FOUND. STILL LOOKING.","THAT SPIKE WAS JUST MADE.","THE SIGN SAID NO. YOU SAID YES.","IMPRESSIVE. TECHNICALLY.","SO CLOSE. SO, SO FAR.","THE TUTORIAL WAS EASIER THAN THIS.","PRESSING JUMP DOES NOT MAKE IT WORK.","RIP AND UNTIL NEXT TIME.","THIS LEVEL REMEMBERS YOU."},
  corporate = {"FEEDBACK LOGGED. TRY AGAIN.","YOUR PERFORMANCE HAS BEEN NOTED.","WE'VE DECIDED TO GO IN A DIFFERENT DIRECTION.","PLEASE RESCHEDULE YOUR SUCCESS.","THIS MEETING COULD HAVE BEEN A RESPAWN.","GREAT ENERGY. WRONG TRAJECTORY.","ACTION ITEM: STOP DYING.","CIRCLE BACK WHEN YOU CAN JUMP."},
  poetic = {"THE VOID ACCEPTS YOUR OFFERING.","A SMALL SQUARE, A GRAND FALL.","GRAVITY: THE OLDEST POEM.","YOU FELL, AS ALL THINGS MUST.","THE PIT KNOWS YOUR NAME NOW.","EACH DEATH, A VERSE. THIS ONE RHYMES.","THE FLOOR YOU TRUSTED HAS MOVED ON.","SILENCE. SQUARES. TRAGEDY."},
  minimal = {"NOPE.","LOL.","...","NO.","AGAIN?","HM.","OOF.","WOW.","OKAY."},
}
Catalog.FAKE_FLAG_MESSAGE = "THE FLAG WAS A LIE"
Catalog.FAKE_CHECKPOINT_MESSAGE = "NOT A CHECKPOINT"

Catalog.ACHIEVEMENTS = {
  {key="first-death",name="WELCOME TO EXOTIC",desc="Die for the first time. The game thanks you."},
  {key="first-clear",name="ACTUALLY NOT BAD",desc="Complete your first level."},
  {key="deaths-25",name="COMMITTED",desc="Reach 25 total deaths."},
  {key="deaths-100",name="CENTURY OF PAIN",desc="Reach 100 total deaths."},
  {key="deaths-250",name="PROFESSIONAL VICTIM",desc="Reach 250 total deaths."},
  {key="flawless",name="UNTOUCHABLE",desc="Complete a level without dying."},
  {key="speedrun",name="AGAINST THE CLOCK",desc="Beat a level under par time."},
  {key="trio",name="THIRD TIME'S THE CHARM",desc="Complete 3 different levels."},
  {key="full-clear",name="EXOTIC CERTIFIED",desc="Complete every level."},
  {key="hoarder",name="SQUARE RICH",desc="Hold 500 coins at once."},
  {key="shopper",name="ENABLING THE ECONOMY",desc="Buy something from the shop."},
}

Catalog.LEVEL_META = {
  {id=1,name="TRUST ISSUES",sub="The floor has opinions.",par=25,deathlessBonus=40},
  {id=2,name="FALSE PROMISES",sub="Flags may be less real than they appear.",par=35,deathlessBonus=50},
  {id=3,name="AIR IS A LIE",sub="Invisible things ruin everything.",par=40,deathlessBonus=60},
  {id=4,name="GRAVITY FLIPS",sub="Up is a suggestion.",par=50,deathlessBonus=70},
  {id=5,name="THE COLLECTOR",sub="Coins are bait. You are the fish.",par=55,deathlessBonus=80},
  {id=6,name="EXOTIC",sub="The final betrayal.",par=70,deathlessBonus=120},
}

Catalog.COIN_VALUE=5; Catalog.CLEAR_REWARD=40; Catalog.FIRST_CLEAR_BONUS=60; Catalog.SPEED_BONUS=40

Catalog.PALETTE = {
  light = {bg="#f1f1ee",tile="#191919",player="#000000",accent="#7c7c7c",subtle="#a2a2a2",far="#000000",text="#000000"},
  dark = {bg="#0b0b0c",tile="#e8e8e6",player="#fafafa",accent="#8c8c8c",subtle="#5c5c5c",far="#ffffff",text="#fafafa"},
}

Catalog.ITEM_MAP = {}
for _, item in ipairs(Catalog.SHOP_ITEMS) do Catalog.ITEM_MAP[item.id] = item end

Catalog.categoryLabel = function(c)
  return c == "skin" and "SKINS" or c == "trail" and "TRAILS" or c == "gear" and "GEAR" or "TAUNTS"
end

Catalog.CATEGORIES = { "skin", "trail", "gear", "taunt" }

return Catalog