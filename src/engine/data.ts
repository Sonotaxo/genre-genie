export type Category = "pulse" | "sound" | "voice" | "atmosphere";
export type Family = "electronic" | "rock" | "hiphop" | "jazz" | "acoustic";

export interface Attribute {
  id: string;
  category: Category;
  question: string;
  hint: string;
  voiceDependent?: boolean;
}

export interface Genre {
  id: string;
  name: string;
  family: Family;
  parent: string | null;
  popularity: number;
  summary: string;
  benchmark: { artist: string; title: string };
  weights: Record<string, number>;
}

export const ATTRIBUTES: Attribute[] = [
  { id: "fast", category: "pulse", question: "Is the music fast — like your heart racing at over 140 beats per minute?", hint: "Think running pace or faster. Drum & Bass, Trance, Punk." },
  { id: "slow", category: "pulse", question: "Is it slow and laid-back, like a lazy head-nod?", hint: "Under ~95 BPM. Hip-hop grooves, ballads, ambient." },
  { id: "four_floor", category: "pulse", question: "Is there a steady kick drum thumping on every single beat — boom, boom, boom, boom?", hint: "The classic 'four-on-the-floor' of House and Techno." },
  { id: "broken_beat", category: "pulse", question: "Do the drums feel choppy, skittering or broken rather than steady?", hint: "Rapid snares and breakbeats like in Drum & Bass." },
  { id: "swing", category: "pulse", question: "Does the rhythm swing or shuffle, like it's bouncing loosely?", hint: "Jazz ride cymbals, boom-bap grooves, funky shuffles." },
  { id: "dance", category: "pulse", question: "Does it make you want to dance in a club?", hint: "Built for the dancefloor rather than for sitting and listening." },
  { id: "headbang", category: "pulse", question: "Does it make you want to headbang or jump in a mosh pit?", hint: "Aggressive, pounding energy." },
  { id: "drop", category: "pulse", question: "Does it build up tension and then explode into a huge 'drop'?", hint: "A long rise followed by a massive release." },
  { id: "no_drums", category: "pulse", question: "Is there basically no drum kit at all?", hint: "Orchestral pieces, solo guitar, ambient drones." },
  { id: "synth", category: "sound", question: "Is the music mostly made of electronic synthesizers and machines?", hint: "Sounds that clearly come from computers, not a band." },
  { id: "distortion", category: "sound", question: "Are there loud, fuzzy, distorted electric guitars?", hint: "That crunchy, gritty roar of a cranked amplifier." },
  { id: "acoustic", category: "sound", question: "Do you hear warm wooden acoustic instruments — acoustic guitar, piano, violin?", hint: "Instruments that don't need to be plugged in." },
  { id: "brass", category: "sound", question: "Are there saxophones, trumpets or other brass horns?", hint: "Jazz solos, soul horn sections." },
  { id: "acid", category: "sound", question: "Is there a bubbling, squealing synth that twists and shrieks?", hint: "Like a Roland TB-303 in Acid House." },
  { id: "wobble", category: "sound", question: "Is there a heavy, growling bass that wobbles or roars like a robot?", hint: "The 'wub-wub' of Dubstep." },
  { id: "deep_bass", category: "sound", question: "Is there a deep sub-bass you feel in your chest?", hint: "Booming 808s or rumbling basslines." },
  { id: "orchestra", category: "sound", question: "Does it sound like an orchestra or a large ensemble?", hint: "Strings, woodwinds, timpani — a concert hall sound." },
  { id: "samples", category: "sound", question: "Does it sound built from chopped-up old records or samples?", hint: "Vinyl crackle, looped soul snippets." },
  { id: "funky_bass", category: "sound", question: "Is there a funky, bouncy bass guitar that grooves?", hint: "Slap bass, Motown-style basslines." },
  { id: "twang", category: "sound", question: "Is there a twangy guitar, banjo or slide guitar?", hint: "Country and folk flavours." },
  { id: "voice_present", category: "voice", question: "Are there any vocals at all?", hint: "Someone singing, rapping or speaking." },
  { id: "rap", category: "voice", question: "Is someone rapping — rhythmic talking over the beat?", hint: "Spoken rhymes rather than a sung melody.", voiceDependent: true },
  { id: "scream", category: "voice", question: "Is the singer screaming, growling or shouting?", hint: "Harsh vocals typical of metal and punk.", voiceDependent: true },
  { id: "smooth_vocal", category: "voice", question: "Is the singing smooth, soulful and emotional?", hint: "Rich melismatic runs, velvety tones.", voiceDependent: true },
  { id: "catchy", category: "voice", question: "Is there a super catchy, sing-along chorus?", hint: "The kind you'd hum all day.", voiceDependent: true },
  { id: "autotune", category: "voice", question: "Do the vocals sound robotic or heavily auto-tuned?", hint: "That glassy, pitch-snapped effect.", voiceDependent: true },
  { id: "dark", category: "atmosphere", question: "Does it feel dark, menacing or gloomy?", hint: "Shadowy warehouse or horror-movie energy." },
  { id: "euphoric", category: "atmosphere", question: "Does it feel euphoric and uplifting, like hands in the air?", hint: "Emotional, sky-high feelings." },
  { id: "chill", category: "atmosphere", question: "Is it relaxing and chilled out?", hint: "Background music for a sunny afternoon." },
  { id: "cavernous", category: "atmosphere", question: "Does it sound huge and spacious, like echoing in a giant warehouse?", hint: "Lots of reverb and space." },
  { id: "intimate", category: "atmosphere", question: "Does it feel intimate, like someone playing in your bedroom?", hint: "Close, quiet, personal." },
  { id: "sunny", category: "atmosphere", question: "Does it feel sunny and tropical, like a beach party?", hint: "Warm, island, summer vibes." },
  { id: "rebellious", category: "atmosphere", question: "Does it feel rebellious, raw or angry?", hint: "Anti-establishment attitude." },
  { id: "hypnotic", category: "atmosphere", question: "Is it hypnotic and repetitive, pulling you into a trance?", hint: "The same loop evolving slowly for minutes." },
  { id: "retro", category: "atmosphere", question: "Does it sound old-school or vintage, like it's from decades ago?", hint: "Pre-1980s production feel." },
];

function w(s: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of s.split(",")) {
    const [k, v] = part.trim().split(":");
    if (k) out[k] = Number(v);
  }
  return out;
}

const ELEC = "synth:1,distortion:-0.8,acoustic:-0.6,orchestra:-0.6,twang:-1,no_drums:-0.8,brass:-0.6,retro:-0.4";

export const GENRES: Genre[] = [
  // ---------- Electronic macros ----------
  { id: "house", name: "House", family: "electronic", parent: null, popularity: 1.4, summary: "Warm, soulful club music built on a steady thumping kick. It's made for long nights of dancing with a feel-good groove.", benchmark: { artist: "Frankie Knuckles", title: "Your Love" }, weights: w(`${ELEC},four_floor:1,dance:1,slow:-0.6,fast:-0.4,euphoric:0.4,voice_present:0.3,smooth_vocal:0.3,hypnotic:0.4,dark:-0.3,funky_bass:0.3,headbang:-0.8,rap:-0.7,scream:-1`) },
  { id: "techno", name: "Techno", family: "electronic", parent: null, popularity: 1.2, summary: "Relentless, machine-driven dance music born in Detroit. Dark, hypnotic loops that pull you into the warehouse.", benchmark: { artist: "Jeff Mills", title: "The Bells" }, weights: w(`${ELEC},four_floor:1,dance:1,dark:0.8,hypnotic:1,cavernous:0.8,voice_present:-0.8,catchy:-0.8,slow:-0.8,euphoric:-0.3,chill:-0.6,rap:-1,scream:-1,sunny:-0.7`) },
  { id: "trance", name: "Trance", family: "electronic", parent: null, popularity: 1.0, summary: "Soaring, emotional electronic music with long build-ups and big uplifting melodies. Pure hands-in-the-air euphoria.", benchmark: { artist: "Paul van Dyk", title: "For An Angel" }, weights: w(`${ELEC},four_floor:1,fast:0.6,dance:1,euphoric:1,drop:0.7,cavernous:0.7,hypnotic:0.6,dark:-0.5,slow:-1,rap:-1,scream:-1`) },
  { id: "dnb", name: "Drum & Bass", family: "electronic", parent: null, popularity: 1.0, summary: "Lightning-fast breakbeats over rolling, heavy basslines. Frantic energy with deep, chest-rattling low end.", benchmark: { artist: "Goldie", title: "Inner City Life" }, weights: w(`${ELEC},fast:1,broken_beat:1,deep_bass:1,dance:0.8,four_floor:-1,slow:-1,drop:0.5,swing:-0.3,scream:-1`) },
  { id: "dubstep", name: "Dubstep", family: "electronic", parent: null, popularity: 0.9, summary: "Heavy, half-time bass music with monstrous growling drops. Feels like giant robots fighting under a strobe light.", benchmark: { artist: "Skrillex", title: "Scary Monsters and Nice Sprites" }, weights: w(`${ELEC},wobble:1,drop:1,deep_bass:1,headbang:0.6,dark:0.6,broken_beat:0.5,four_floor:-0.8,chill:-0.8,smooth_vocal:-0.5`) },
  { id: "ambient", name: "Ambient", family: "electronic", parent: null, popularity: 0.7, summary: "Floating, atmospheric soundscapes with little to no beat. Music to drift away to rather than dance.", benchmark: { artist: "Brian Eno", title: "An Ending (Ascent)" }, weights: w(`synth:0.8,no_drums:1,chill:1,cavernous:0.8,hypnotic:0.6,dance:-1,headbang:-1,voice_present:-0.8,fast:-1,slow:0.6,four_floor:-1,distortion:-1,drop:-1,catchy:-1,rap:-1`) },
  // ---------- House subgenres ----------
  { id: "deep_house", name: "Deep House", family: "electronic", parent: "house", popularity: 1.0, summary: "The smoothest, most soulful corner of house — warm chords and mellow grooves. Late-night rooftop energy.", benchmark: { artist: "Larry Heard", title: "Can You Feel It" }, weights: w(`${ELEC},four_floor:1,dance:0.6,chill:0.8,smooth_vocal:0.6,acid:-0.8,euphoric:0,dark:-0.2,intimate:0.4,drop:-0.6`) },
  { id: "tech_house", name: "Tech House", family: "electronic", parent: "house", popularity: 1.2, summary: "Punchy, stripped-back house with groovy percussion and rolling bass. Built to make a packed club bounce.", benchmark: { artist: "Fisher", title: "Losing It" }, weights: w(`${ELEC},four_floor:1,dance:1,deep_bass:0.7,drop:0.6,hypnotic:0.6,chill:-0.5,acid:-0.3,smooth_vocal:-0.4,retro:-0.8`) },
  { id: "acid_house", name: "Acid House", family: "electronic", parent: "house", popularity: 0.7, summary: "Raw, squelchy late-80s house driven by the bubbling TB-303 synth. Psychedelic and hypnotic.", benchmark: { artist: "Phuture", title: "Acid Tracks" }, weights: w(`synth:1,four_floor:1,dance:1,acid:1,hypnotic:0.8,retro:0.6,voice_present:-0.5,chill:-0.4`) },
  { id: "french_house", name: "French Touch", family: "electronic", parent: "house", popularity: 0.8, summary: "Filtered disco samples and funky, sunny grooves from Paris. Glittery, nostalgic and irresistible.", benchmark: { artist: "Daft Punk", title: "One More Time" }, weights: w(`synth:0.7,four_floor:1,dance:1,samples:1,funky_bass:0.8,autotune:0.6,euphoric:0.6,sunny:0.4,dark:-0.8,acid:-0.6`) },
  // ---------- Techno subgenres ----------
  { id: "minimal_techno", name: "Minimal Techno", family: "electronic", parent: "techno", popularity: 0.8, summary: "Techno stripped to its bare bones: clicks, pulses and subtle shifts. Deeply hypnotic and patient.", benchmark: { artist: "Richie Hawtin", title: "Spastik" }, weights: w(`${ELEC},four_floor:1,hypnotic:1,distortion:-1,headbang:-0.8,intimate:0.3,dark:0.3,drop:-0.8`) },
  { id: "industrial_techno", name: "Industrial Techno", family: "electronic", parent: "techno", popularity: 0.7, summary: "Pounding, distorted techno that sounds like heavy machinery. Brutal, dark and relentless.", benchmark: { artist: "Surgeon", title: "Magneze" }, weights: w(`synth:1,four_floor:1,fast:0.6,distortion:0.5,dark:1,headbang:0.6,cavernous:1,rebellious:0.5,chill:-1`) },
  // ---------- Rock family ----------
  { id: "rock", name: "Classic Rock", family: "rock", parent: null, popularity: 1.3, summary: "Guitar-driven anthems with big riffs and soaring vocals. Stadium-sized energy that never gets old.", benchmark: { artist: "Led Zeppelin", title: "Whole Lotta Love" }, weights: w("distortion:0.7,synth:-0.7,voice_present:0.9,catchy:0.6,retro:0.8,headbang:0.4,rebellious:0.3,four_floor:-0.5,rap:-1,autotune:-1,no_drums:-1") },
  { id: "metal", name: "Metal", family: "rock", parent: null, popularity: 1.0, summary: "Crushingly heavy guitars, thundering drums and intense vocals. Maximum power and aggression.", benchmark: { artist: "Metallica", title: "Master of Puppets" }, weights: w("distortion:1,headbang:1,dark:0.8,fast:0.5,scream:0.7,synth:-0.8,chill:-1,dance:-0.6,rebellious:0.6,sunny:-1,rap:-0.9,smooth_vocal:-0.6,no_drums:-1,four_floor:-0.6") },
  { id: "punk", name: "Punk", family: "rock", parent: null, popularity: 0.8, summary: "Short, fast, loud and snotty. Three chords and a whole lot of attitude.", benchmark: { artist: "Ramones", title: "Blitzkrieg Bop" }, weights: w("distortion:0.8,fast:1,rebellious:1,headbang:0.7,voice_present:1,catchy:0.4,synth:-0.8,chill:-1,smooth_vocal:-0.8,orchestra:-1,no_drums:-1") },
  { id: "indie", name: "Indie Rock", family: "rock", parent: null, popularity: 1.1, summary: "Jangly guitars, quirky melodies and heartfelt lyrics. Feels like a sweaty small-venue gig.", benchmark: { artist: "Arctic Monkeys", title: "I Bet You Look Good on the Dancefloor" }, weights: w("distortion:0.3,voice_present:1,catchy:0.6,intimate:0.3,synth:-0.3,scream:-0.6,rap:-0.9,headbang:0,orchestra:-0.8,no_drums:-1,autotune:-0.8") },
  { id: "black_metal", name: "Black Metal", family: "rock", parent: "metal", popularity: 0.5, summary: "Freezing, lo-fi tremolo guitars and blast beats with shrieked vocals. Atmospheric and very dark.", benchmark: { artist: "Mayhem", title: "Freezing Moon" }, weights: w("distortion:1,fast:1,scream:1,dark:1,cavernous:0.7,catchy:-1,chill:-1") },
  { id: "death_metal", name: "Death Metal", family: "rock", parent: "metal", popularity: 0.5, summary: "Brutal, down-tuned riffs and guttural growls. The heaviest of the heavy.", benchmark: { artist: "Death", title: "Pull the Plug" }, weights: w("distortion:1,fast:0.7,scream:1,headbang:1,dark:0.8,deep_bass:0.5,cavernous:-0.3,catchy:-1") },
  { id: "doom_metal", name: "Doom Metal", family: "rock", parent: "metal", popularity: 0.4, summary: "Slow, crushing, gloomy riffs that drag like molten lava. Heavy as a funeral.", benchmark: { artist: "Black Sabbath", title: "Black Sabbath" }, weights: w("distortion:1,slow:1,fast:-1,dark:1,headbang:0.5,retro:0.4,scream:0") },
  { id: "thrash_metal", name: "Thrash Metal", family: "rock", parent: "metal", popularity: 0.7, summary: "Fast, galloping riffs and shouted vocals. Pure circle-pit adrenaline.", benchmark: { artist: "Slayer", title: "Angel of Death" }, weights: w("distortion:1,fast:1,headbang:1,rebellious:0.7,scream:0.3,catchy:0.2,retro:0.4") },
  // ---------- Hip-Hop & Urban ----------
  { id: "hiphop", name: "Hip-Hop", family: "hiphop", parent: null, popularity: 1.4, summary: "Rhythmic rapping over beats and samples. Head-nodding grooves and sharp wordplay.", benchmark: { artist: "Nas", title: "N.Y. State of Mind" }, weights: w("rap:1,voice_present:1,slow:0.5,samples:0.6,deep_bass:0.5,swing:0.4,distortion:-0.8,four_floor:-0.6,fast:-0.6,scream:-0.6,orchestra:-0.4,no_drums:-1") },
  { id: "rnb", name: "R&B", family: "hiphop", parent: null, popularity: 1.2, summary: "Smooth, sensual vocals over silky grooves. Romance and late-night feelings.", benchmark: { artist: "Aaliyah", title: "Are You That Somebody?" }, weights: w("smooth_vocal:1,voice_present:1,slow:0.6,deep_bass:0.4,intimate:0.5,chill:0.4,distortion:-1,scream:-1,headbang:-1,fast:-0.7,rap:-0.2,catchy:0.5") },
  { id: "reggae", name: "Reggae", family: "hiphop", parent: null, popularity: 0.8, summary: "Laid-back offbeat guitar chops and heavy, warm bass. Sunny island vibes with a message.", benchmark: { artist: "Bob Marley", title: "Could You Be Loved" }, weights: w("sunny:1,chill:0.7,slow:0.5,deep_bass:0.6,funky_bass:0.3,voice_present:0.9,retro:0.5,distortion:-0.8,fast:-0.8,dark:-0.7,headbang:-1,four_floor:-0.4") },
  { id: "boom_bap", name: "Boom Bap", family: "hiphop", parent: "hiphop", popularity: 0.8, summary: "Classic 90s hip-hop: punchy dusty drums and soulful samples. Pure head-nod.", benchmark: { artist: "Gang Starr", title: "Mass Appeal" }, weights: w("rap:1,samples:1,swing:0.8,retro:0.6,autotune:-1,deep_bass:-0.2,dark:0") },
  { id: "trap", name: "Trap", family: "hiphop", parent: "hiphop", popularity: 1.2, summary: "Booming 808 bass, rattling hi-hats and auto-tuned flows. Modern, flashy and hard-hitting.", benchmark: { artist: "Migos", title: "Bad and Boujee" }, weights: w("rap:1,deep_bass:1,autotune:0.8,synth:0.6,samples:-0.3,retro:-1,swing:-0.4,dark:0.4") },
  { id: "drill", name: "Drill", family: "hiphop", parent: "hiphop", popularity: 0.7, summary: "Dark, sliding 808s and menacing flows with skittering drums. Gritty street energy.", benchmark: { artist: "Pop Smoke", title: "Dior" }, weights: w("rap:1,dark:1,deep_bass:1,broken_beat:0.6,synth:0.5,retro:-1,sunny:-1,chill:-0.8") },
  { id: "lofi", name: "Lo-Fi Hip-Hop", family: "hiphop", parent: "hiphop", popularity: 0.8, summary: "Dusty, mellow beats with vinyl crackle and jazzy chords. Study music for rainy days.", benchmark: { artist: "Nujabes", title: "Feather" }, weights: w("samples:1,chill:1,intimate:0.8,swing:0.6,voice_present:-0.6,rap:-0.3,deep_bass:-0.2,dark:-0.4,dance:-1") },
  // ---------- Jazz & Soul ----------
  { id: "jazz", name: "Jazz", family: "jazz", parent: null, popularity: 1.0, summary: "Improvised, swinging music full of horns and clever chords. Smoky clubs and spontaneous magic.", benchmark: { artist: "Miles Davis", title: "So What" }, weights: w("swing:1,brass:0.9,acoustic:0.6,retro:0.8,intimate:0.5,synth:-1,distortion:-1,four_floor:-1,rap:-1,autotune:-1,scream:-1,drop:-1,voice_present:-0.3") },
  { id: "funk", name: "Funk & Soul", family: "jazz", parent: null, popularity: 1.0, summary: "Tight grooves, slap bass and powerful soulful vocals. Impossible not to move to.", benchmark: { artist: "James Brown", title: "Get Up (I Feel Like Being a) Sex Machine" }, weights: w("funky_bass:1,brass:0.7,dance:0.7,retro:0.9,smooth_vocal:0.5,voice_present:0.8,sunny:0.4,synth:-0.5,distortion:-0.6,dark:-0.8,scream:-0.8,autotune:-0.8") },
  { id: "bebop", name: "Bebop", family: "jazz", parent: "jazz", popularity: 0.6, summary: "Blazing-fast, virtuosic jazz with dizzying solos. Intense and brilliant.", benchmark: { artist: "Charlie Parker", title: "Ko-Ko" }, weights: w("swing:1,fast:1,brass:1,voice_present:-1,chill:-0.5") },
  { id: "smooth_jazz", name: "Smooth Jazz", family: "jazz", parent: "jazz", popularity: 0.6, summary: "Polished, relaxing jazz with silky sax melodies. Elevator-perfect calm.", benchmark: { artist: "Grover Washington Jr.", title: "Mister Magic" }, weights: w("brass:0.8,chill:1,slow:0.6,synth:0.2,fast:-1,funky_bass:0.4,swing:0") },
  { id: "vocal_jazz", name: "Vocal Jazz", family: "jazz", parent: "jazz", popularity: 0.7, summary: "Velvet-voiced singers fronting swinging jazz bands. Timeless and romantic.", benchmark: { artist: "Ella Fitzgerald", title: "Summertime" }, weights: w("voice_present:1,smooth_vocal:1,swing:0.8,intimate:0.6,retro:1") },
  // ---------- Classical & Acoustic ----------
  { id: "classical", name: "Classical", family: "acoustic", parent: null, popularity: 1.0, summary: "Orchestral and chamber music from the concert hall tradition. Grand, dramatic and timeless.", benchmark: { artist: "Beethoven", title: "Symphony No. 5" }, weights: w("orchestra:1,no_drums:0.9,acoustic:0.9,voice_present:-0.7,synth:-1,distortion:-1,rap:-1,dance:-1,four_floor:-1,deep_bass:-0.6,cavernous:0.4,autotune:-1,drop:-1") },
  { id: "folk", name: "Folk", family: "acoustic", parent: null, popularity: 0.9, summary: "Storytelling songs on acoustic guitar and simple arrangements. Honest, earthy and intimate.", benchmark: { artist: "Bob Dylan", title: "Blowin' in the Wind" }, weights: w("acoustic:1,intimate:1,voice_present:1,no_drums:0.5,retro:0.5,synth:-1,distortion:-1,dance:-0.8,deep_bass:-1,rap:-1,scream:-1,four_floor:-1,orchestra:-0.5") },
  { id: "country", name: "Country", family: "acoustic", parent: null, popularity: 1.0, summary: "Twangy guitars and heartfelt stories about life, love and the open road. Pickup-truck singalongs.", benchmark: { artist: "Johnny Cash", title: "Ring of Fire" }, weights: w("twang:1,acoustic:0.7,voice_present:1,catchy:0.6,synth:-0.8,rap:-0.8,dark:-0.4,deep_bass:-0.6,four_floor:-0.5,scream:-1") },
  { id: "pop", name: "Pop", family: "acoustic", parent: null, popularity: 1.5, summary: "Polished, hook-filled songs built for the radio. Instantly catchy and made for everyone.", benchmark: { artist: "Michael Jackson", title: "Billie Jean" }, weights: w("catchy:1,voice_present:1,dance:0.5,synth:0.4,euphoric:0.4,smooth_vocal:0.4,dark:-0.6,scream:-1,distortion:-0.4,hypnotic:-0.4,no_drums:-0.8") },
  { id: "baroque", name: "Baroque", family: "acoustic", parent: "classical", popularity: 0.6, summary: "Ornate, intricate music with harpsichords and interweaving melodies. Elegant clockwork.", benchmark: { artist: "J.S. Bach", title: "Brandenburg Concerto No. 3" }, weights: w("orchestra:0.7,retro:1,fast:0.3,dark:-0.4,cavernous:-0.2") },
  { id: "romantic", name: "Romantic Era", family: "acoustic", parent: "classical", popularity: 0.7, summary: "Sweeping, emotional orchestral drama from the 1800s. Big feelings, big orchestras.", benchmark: { artist: "Tchaikovsky", title: "Swan Lake" }, weights: w("orchestra:1,cavernous:0.8,euphoric:0.5,dark:0.2") },
  { id: "solo_piano", name: "Solo Piano", family: "acoustic", parent: "classical", popularity: 0.6, summary: "A single piano filling the room with delicate and expressive melodies. Quiet and intimate.", benchmark: { artist: "Chopin", title: "Nocturne Op. 9 No. 2" }, weights: w("orchestra:-1,intimate:1,chill:0.7,cavernous:-0.5") },
];

export const FAMILIES: { id: Family; label: string; emoji: string }[] = [
  { id: "electronic", label: "Electronic & Dance", emoji: "⚡" },
  { id: "rock", label: "Rock & Metal", emoji: "🎸" },
  { id: "hiphop", label: "Hip-Hop & Urban", emoji: "🎤" },
  { id: "jazz", label: "Jazz & Soul", emoji: "🎷" },
  { id: "acoustic", label: "Classical & Acoustic", emoji: "🎻" },
];

export const CATEGORY_META: Record<Category, { label: string; emoji: string }> = {
  pulse: { label: "The Pulse", emoji: "🟢" },
  sound: { label: "The Sound", emoji: "🟣" },
  voice: { label: "The Voice", emoji: "🔵" },
  atmosphere: { label: "The Atmosphere", emoji: "🟠" },
};
