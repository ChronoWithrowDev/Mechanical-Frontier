export const DISTRICTS = [
  { name: "Sky Foundry", color: "#6ee7ed", tint: 0x5de6e8, tagline: "Weld the weather. Rewire the impossible." },
  { name: "Glass Garden", color: "#a8f0c0", tint: 0x8ce8ae, tagline: "Every seed remembers the stars." },
  { name: "Signal Depths", color: "#8da9ff", tint: 0x829bff, tagline: "The mountain is listening." },
  { name: "Mechwood", color: "#efbd78", tint: 0xe9a85f, tagline: "A forest with a very big heartbeat." },
  { name: "Arc Vaults", color: "#d89bff", tint: 0xc385fa, tagline: "Handle strange energy with care." },
  { name: "Crystal Coast", color: "#65d8d6", tint: 0x48cecc, tagline: "Tide pools, moon pools, and one portal." },
  { name: "Chrono Lab", color: "#ffc187", tint: 0xffad70, tagline: "Time is a tool. Please wear goggles." },
  { name: "Moonwell", color: "#c2b6ff", tint: 0xb3a0ff, tagline: "Gravity takes a night off here." },
  { name: "Wild Circuit", color: "#c5eb83", tint: 0xb0df67, tagline: "Machines grow wild when no one is looking." },
  { name: "Starship Graveyard", color: "#f1a2c4", tint: 0xf08db7, tagline: "Every lost ship still has a story." },
] as const;

const ROOM_NAMES = [
  ["The Copper Sunrise", "Cloudline Foundry", "The Singing Anvil", "Lightning Loom", "Kiln of Small Suns", "The Weather Engine", "Brass Comet Works", "Aerial Rail Depot", "The Whirring Gallery", "Last Light Assembly"],
  ["Fernlight Conservatory", "The Glass Orchard", "Moss & Mechanism", "Firefly Reservoir", "Pollen Observatory", "The Greenhouse That Wanders", "Rainmaker Atrium", "Rootbound Workshop", "The Humming Apiary", "Petal Engine No. 9"],
  ["Whale-Song Receiver", "The Quiet Relay", "Canyon Radio", "Echo Chamber 04", "The Faraway Frequency", "Static & Stardust", "The Switchback Signal", "Underpeak Listening Post", "The Mountain's Reply", "Zero-Noise Room"],
  ["Giant's Welcome Mat", "The Walking Orchard", "Sap & Servo", "The Stump Observatory", "Redwood Robotics", "Mech Weapons Bay", "The Ironwood Nursery", "Acorn Reactor", "Bearbot Parade Route", "The Timber Titan"],
  ["The Violet Battery", "Prism Concourse", "The Gravity Pantry", "Unstable but Friendly", "The Thousand-Volt Library", "Mirror-Mirror Chamber", "Arc Lamp Lagoon", "Geode Generator", "The Orbital Index", "A Very Small Singularity"],
  ["The Inland Tide", "Bubble Cartography", "Cyanide-Free Coral Lab", "The Tidal Clock", "Sandcastle Substation", "Kelp Cableway", "Portal Gun Gallery", "Moon Jelly Junction", "The Ship in a Bottle", "The Last Blue Pool"],
  ["The Tuesday Machine", "Second Hand Bazaar", "Yesterday's Workshop", "Shrink-Ray Laboratory", "The Loop-De-Loop", "Three O'Clock Somewhere", "Tomorrow's Attic", "A Brief Detour", "The Unwound Room", "Timekeeper's Lunch Break"],
  ["Weightless Tea Party", "The Orbitarium", "Dust Bunny Moon", "The Downward Sky", "Comet Sleeping Car", "Satellite Swing Set", "The Long Fall Lounge", "Lunar Daydream", "Eclipse Engine", "The Quiet Side of the Moon"],
  ["Self-Watering Circuit", "The Cuckoo Computer", "Wildflower Server Farm", "The Overgrown Mainframe", "Bee-Safe Firewall", "The Mossy Motherboard", "Sundial Supercomputer", "Cloverfield Test Range", "The Birdsong Router", "The Patch Notes Meadow"],
  ["Portside Memory", "The Sleepy Starliner", "Vacuum Tube Motel", "Deck Seven Garden", "Salvage of the Brave", "The Last Transmission", "Orbiting Flea Market", "The Comet-Fall Hangar", "Little Blue Escape Pod", "Homeward-Bound Bridge"],
] as const;

const ROOM_STORIES = [
  ["An apprentice left a sunrise in the furnace. It is still glowing.", "Build a stable bridge between two drifting cloud platforms.", "A patient anvil hums back when you tap out a rhythm.", "Redirect three little bolts without getting a spark on your boots.", "Reignite the miniature star and admire your extremely safe sun shield.", "The storm has lost its key. Help its six cloud sprites find it.", "A brass comet needs its tail rebuilt before the next launch.", "Send a moonstone parcel down the right aerial rail.", "The gallery's clockwork instruments are playing out of tune.", "Reassemble the dawn prism. Chrono is saving you front-row seats."],
  ["A seed from Mars has taken root in Colorado soil.", "Grow a ladder of glass vines up to the skylight.", "The friendly moss has tangled all the blueprints.", "Guide fireflies to the reservoir in a glowing constellation.", "The telescope is pollen-blind; polish its six delicate lenses.", "This greenhouse keeps walking off. Find its home coordinates.", "Give the dry clouds a gentle nudge over the gardens.", "A shy root robot needs help finding its charging spot.", "The bees have rebuilt their hive in the wrong dimension.", "Discover which flower is secretly powering the building."],
  ["There's a whale's lullaby hiding in the radio static.", "The relay is sending a message from exactly one minute ago.", "Trace a missing broadcast through a tiny model canyon.", "Move through the echo chamber without disturbing its song.", "The distant voice is kind. It would like its frequency returned.", "A shooting star has gotten stuck between two radio stations.", "Restore the hiking trail signal beacons, one gentle pulse at a time.", "Listen closely: the mountain only answers musical questions.", "Translate the reply into the three colors of a Colorado sunset.", "Take one perfectly quiet breath and collect the hidden signal."],
  ["A two-story robot has wandered in to ask for directions.", "Help the apple trees take a stroll before sunset.", "Find the missing ingredient in a recipe for friendly robots.", "A very tiny telescope is looking for one very large stump.", "The Redwood Rangers need their acorn-powered legs rebalanced.", "Tune scout mechs, pulse-cannon tools, and nonlethal shields in a full-size mech hangar.", "Program gentle rain and a warm place for ten robot saplings.", "A reactor built from an acorn is producing excellent toast.", "Rehearse a parade with the exceptionally well-behaved Bearbots.", "The Timber Titan has a splinter in its friendly left heel."],
  ["The battery is shy. Say hello with a matching pulse.", "Align seven spectral windows into a rainbow bridge.", "The pantry keeps swapping up and down. No snacks have fallen.", "A wobbly experiment needs exactly three calm, well-timed pulses.", "Return a misfiled shooting star to its very large library book.", "Help your mirror-image open a door from the other side.", "The lamps love music; set their rhythm and watch them bloom.", "A beautiful purple geode is humming in Morse code.", "The index has misplaced one orbit among countless paper stars.", "Shrink a polite black hole just enough to tuck it in."],
  ["A little tide has made a very big map of Walsenburg.", "Map each bubble before it floats away to the ceiling.", "Our corals are exceptionally chill and very good at maths.", "Three moon phases need to agree on what time it is.", "Build the world's most temporary underwater castle.", "Route a glowing cable through a friendly kelp forest.", "Test a rack of portal stitchers, link the glowing gates, and zip safely across the gallery.", "A moon jelly is trying to catch its own reflection.", "A message in a bottle travelled a very long way home.", "The last pool holds a tiny piece of the real night sky."],
  ["Tuesday got itself stuck in a very polite loop.", "Trade an hourglass for the exact same hourglass, yesterday.", "A note from your future self asks for one extra sandwich.", "Use a friendly shrink ray to miniaturize five giant props, from boulder size to pocket size.", "A small red ball really does enjoy this room too much.", "Set the clocks to the time Chrono was born: snack o'clock.", "The attic is full of future inventions and one old sock.", "Take a two-step detour. Arrive precisely where you started.", "The room needs to be unwound slowly, not unsafely.", "Chrono's lunch break is over. The jam is still excellent."],
  ["Have a sip of tea; it is the only thing with gravity.", "Put the model planets in their nice, tidy orbits.", "Dust bunnies have discovered their inner moon explorer.", "Turn the night sky gently right-side up.", "A comet needs a blanket and five more minutes.", "Untangle the satellite swings without waking the moon.", "Fall slowly toward an extremely comfortable pillow.", "Catch the eclipse at the exact center of its shadow.", "The moon's engine is purring, but its dial is upside down.", "Discover why the quiet side is humming your favorite tune."],
  ["The circuit can water itself; the flowers just need a hint.", "A cuckoo has learned binary and would like a compliment.", "Find the wildflowers hiding between humming servers.", "Help a patient computer grow a little branch of its own.", "The bees have a surprisingly good spam filter.", "The motherboard has sprouted mint. That is probably fine.", "Teach the supercomputer to follow a Colorado sundial.", "Guide three clover bots across the sunlit test meadow.", "Route birdsong around a sleepy, tangled router.", "The meadow has one very important update for your gear."],
  ["The starliner is late but its tea is still warm.", "Help this gentle old ship find the right constellation.", "The motel has vacancies on several lovely moons.", "Grow a tiny garden where no one thought to put one.", "The salvagers brought everything home, including the sunset.", "A hopeful signal is hiding behind one quiet asteroid.", "Browse a flea market that only opens in orbit.", "An old hangar needs one very clean comet catcher.", "A tiny pod needs a good name before it flies home.", "Set a course for Earth. Chrono saved the window seat."],
] as const;

const ARTIFACTS = [
  "Copper Sunwheel", "Cloud-Catcher Coil", "Anvilheart Bell", "Stormthread Spool", "Sunshield Spark", "Weatherbone Gear", "Comet-Tail Dynamo", "Railrunner Token", "Resonance Fork", "First-Light Core",
  "Featherlight Compass", "Verdant Lens", "Moss-Circuit Schematic", "Firefly in a Bottle", "Pollen-Safe Scope", "Wandering Seed", "Rainmaker Pin", "Rootbound Wrench", "Honeywave Crystal", "Bloomdrive Bud",
  "Singing Receiver", "Quiet Frequency", "Canyon Echo Pearl", "Echo-Ward Charm", "Faraway Tuner", "Starstatic Vial", "Trailblazer Beacon", "Mountain's Answer", "Stillpoint Stone", "Signal in a Teacup",
  "Giant's Button", "Walking Apple", "Sap-Safe Battery", "Stumpfinder Scope", "Redwood Cog", "Moss-Paw Pad", "Ironwood Seedling", "Toast Acorn", "Bearbot Badge", "Titan's Thimble",
  "Polite Powercell", "Prism Window", "Gravity Cracker", "Calm Pulse", "Library Comet", "Mirror Key", "Arcwave Chime", "Geode Songstone", "Orbit Index Card", "Pocket Event Horizon",
  "Inland Tidepool", "Bubble Atlas", "Coral Decoder", "Moonphase Dial", "Sandcastle Spire", "Kelp-Cable Clip", "Low-Tide Token", "Moon Jelly Marble", "Homeward Bottle", "Blue-Pool Shard",
  "Tuesday's Ticket", "Hourglass Swap", "Future Sandwich Note", "Raincheck Gear", "Loop-De-Loop Pin", "Snacktime Stopwatch", "Future-Sock Fabric", "Detour Compass", "Unwinding Key", "Jam O'Clock Spoon",
  "Tea Party Teaspoon", "Orbital Orrery", "Dust-Moon Pebble", "Skyside-Up Pin", "Comet's Comforter", "Satellite Swing Tag", "Slow-Fall Feather", "Eclipse Seed", "Lunar Purr Dial", "Quiet-Side Lullaby",
  "Self-Watering Seed", "Cuckoo's Clicker", "Serverflower", "Overgrown Byte", "Bee-Safe Shield", "Minty Motherboard", "Sundial Bit", "Clover Bot Badge", "Birdsong Router", "Meadow Update",
  "Starliner Postcard", "Constellation Thread", "Moon-Motel Key", "Deck-Seven Seed", "Brave Salvage Pin", "Last Transmission Tape", "Orbit Market Token", "Comet Catcher", "Pod Nameplate", "Homeward Star",
] as const;

export const GADGET_FAMILIES = ["pulse", "grapple", "portal", "shrink", "grow"] as const;

const GADGET_ACTIONS = [
  "projects a cheerful resonance pulse that makes friendly characters dance",
  "creates a soft gravity tug that slides friendly characters closer",
  "stitches a short pink portal that safely relocates friendly characters",
  "wraps friendly characters—or you, when aimed straight down—in a temporary pocket-size field",
  "inflates friendly characters—or you, when aimed straight down—to towering giant size",
] as const;

export const ROOMS = DISTRICTS.flatMap((district, districtIndex) =>
  ROOM_NAMES[districtIndex].map((name, localIndex) => {
    const index = districtIndex * 10 + localIndex;
    const gadgetType = GADGET_FAMILIES[index % GADGET_FAMILIES.length];
    const gadget = index === 35 ? "Mech Pilot Gauntlet" : index === 56 ? "Tidefold Portal Gun" : index === 63 ? "Chrono's Pocket Shrink Ray" : ARTIFACTS[index];
    return {
      index,
      number: String(index + 1).padStart(2, "0"),
      district: district.name,
      districtIndex,
      title: name,
      description: ROOM_STORIES[districtIndex][localIndex],
      artifact: ARTIFACTS[index],
      gadget,
      gadgetType,
      gadgetDetail: `${gadget} ${GADGET_ACTIONS[index % GADGET_ACTIONS.length]}.`,
      color: district.color,
      tint: district.tint,
      tagline: district.tagline,
    };
  }),
);

export const TOOLS = [
  { id: "pulse", name: "Pulse Blaster", short: "PULSE", detail: "A kind little beam. Wakes ancient targets without leaving a mark.", glyph: "◈", color: "#77f0e5", key: "1" },
  { id: "grapple", name: "Gravity Gloves", short: "GRAVITY", detail: "Give a loose gizmo a friendly nudge. Useful in every workshop.", glyph: "✣", color: "#b7a0ff", key: "2" },
  { id: "portal", name: "Portal Stitcher", short: "PORTAL", detail: "Click open ground to fold space and zip to a new spot.", glyph: "◉", color: "#ffa0cd", key: "3" },
  { id: "shrink", name: "Shrink Ray", short: "SHRINK", detail: "Shrink beacons and neighbors—or look straight down and fire to shrink yourself.", glyph: "⌁", color: "#ffd181", key: "4" },
  { id: "grow", name: "Grow Ray", short: "GROW", detail: "Enlarge beacons and neighbors—or look straight down and fire to grow yourself.", glyph: "⇑", color: "#a6f08f", key: "5" },
] as const;

export const LASER_SWORD = {
  id: "saber",
  name: "Withrow Laser Sword",
  short: "SABER",
  detail: "A crackling energy blade. Swing it to defeat NPCs—they respawn a few seconds later.",
  glyph: "⚔",
  color: "#ff4d6d",
  key: "6",
} as const;

export const B10_PYLON = {
  id: "pylon",
  name: "The Dreamcore",
  short: "DREAM",
  detail: "Select, then RIGHT-CLICK on open ground to place. Opens the AI creator to build any object!",
  glyph: "☄",
  color: "#e2b6ff",
  key: "7",
} as const;

export const ALL_TOOLS = [...TOOLS, LASER_SWORD, B10_PYLON] as const;

export const SECRET_ITEMS = ["Flight Module", "Withrow Mech", "Withrow Laser Sword", "NPC Synthesizer", "B10 Chronal Pylon"] as const;

export const STORY_GREETING = [
  "Whoa—you're here! I'm Chrono. I'm ten, I built that elevator, and I only got stuck in it twice.",
  "Welcome to Lizard Town! Down here there's a whole world of gadgets, mechs, and gizmos ahead. One hundred rooms, to be exact.",
  "That little pulse blaster wakes the room beacons. Light up all three, then inspect the big glowing thing to take home a brand-new gadget.",
  "Try your gadgets on the neighbors if you like—pulse makes them dance, gravity gives a gentle tug, portals make shortcuts, and the shrink and grow rays resize them. Aim either ray straight down to try it on yourself! Ready?", 
];
