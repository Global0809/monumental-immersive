import type { Place, Period, Video } from '../platform/catalogue/domain';

export const places: Place[] = [
  {
    id: "miami",
    name: "Miami",
    country: "United States",
    kind: "City",
    lat: 25.7617,
    lon: -80.1918,
    image: "/media/miami.webp",
    tagline: "Where worlds find a rhythm.",
    description:
      "Our opening cultural gateway. Explore music, food and design across Greater Miami, with Miami Beach identified separately in the stories that concern it. Launch plans are in development; no event date or venue is confirmed.",
  },
  {
    id: "puerto-rico",
    name: "Puerto Rico",
    country: "United States territory",
    kind: "Island territory",
    lat: 18.2208,
    lon: -66.5901,
    image: "/media/puerto-rico.webp",
    tagline: "An island. A world of influence.",
    description:
      "A Caribbean island territory with living musical traditions including bomba and plena. The opening WAVEMAKERS journey begins here. Gateway photograph: Old San Juan; the marker represents Puerto Rico as a whole.",
  },
  {
    id: "new-york",
    name: "New York",
    country: "United States",
    kind: "City",
    lat: 40.7128,
    lon: -74.006,
    image: "/media/new-york.webp",
    tagline: "Every block, another beginning.",
    description:
      "A gateway to the neighbourhood histories behind global culture. Our first historical study looks towards the Bronx and the early years of hip-hop. The gateway photograph shows Manhattan, not the Bronx.",
  },
  {
    id: "london",
    name: "London",
    country: "United Kingdom",
    kind: "City",
    lat: 51.5074,
    lon: -0.1278,
    image: "/media/london.webp",
    tagline: "Different roots. Shared frequencies.",
    description:
      "The final destination in the planned Valid ID WAVEMAKERS journey. Explore an illustrated introduction to the connections between east London, pirate radio and the musical experiments of the 1990s.",
  },
  {
    id: "tokyo",
    name: "Tokyo",
    country: "Japan",
    kind: "Metropolis",
    lat: 35.6762,
    lon: 139.6503,
    image: "/media/tokyo.webp",
    tagline: "A thousand ways to be yourself.",
    description:
      "Discover a visual study of self-expression through the lens of Harajuku street fashion. Gateway photograph: the Shinjuku skyline, a wider Tokyo illustration rather than a photograph of Harajuku.",
  },
  {
    id: "rio",
    name: "Rio de Janeiro",
    country: "Brazil",
    kind: "City",
    lat: -22.9068,
    lon: -43.1729,
    image: "/media/rio.webp",
    tagline: "Culture moves through the city.",
    description:
      "A Brazilian coastal city where neighbourhood culture and music connect. Our introductory study follows the idea of rhythm as shared memory, with context on samba’s connections to Bahia.",
  },
];

export const periods: Period[] = [
  {
    id: "1930s",
    label: "1930s",
    description:
      "Design takes shape. A contemporary illustrated study introduces the Art Deco language of Miami Beach. The available video is newly created, not archival footage.",
  },
  {
    id: "1970s",
    label: "1970s",
    description:
      "A new musical language. Explore a contemporary illustrated introduction to hip-hop’s early Bronx context. The video concerns this period; it was created in 2026.",
  },
  {
    id: "1990s",
    label: "1990s",
    description:
      "Signals across the city. A contemporary illustrated essay connects London’s club and pirate-radio scenes with a decade of musical experimentation. No historical recordings are used.",
  },
  {
    id: "2000s",
    label: "2000s",
    description:
      "Open film arrives. Big Buck Bunny and its trailer were released in 2008. This collection concerns the film’s publication era; its fictional story has no claimed historical setting.",
  },
  {
    id: "2010s",
    label: "2010s",
    description:
      "Independent worlds. Sintel and its trailer were released in 2010. This collection concerns open cinema’s publication era, not a historical setting within its fantasy story.",
  },
  {
    id: "now",
    label: "Now",
    description:
      "Living connections. Contemporary editorial motion studies offer starting points for exploring places, ideas and influences. Planned Monumental Originals are clearly marked in development.",
  },
];

const studyCredit =
  "Original procedural film, text and synthetic sound created for this preview collection (2026). Computer-generated narration. Destination photographs are separately credited in the source manifest.";
const study = (
  v: Omit<
    Video,
    "publishedAt" | "status" | "access" | "credit" | "src" | "captions"
  >,
): Video => ({
  ...v,
  publishedAt: "2026-10-20",
  status: "available",
  access: "free",
  credit: studyCredit,
  src: `/media/${v.id}.mp4`,
  captions: `/captions/${v.id}.vtt`,
});

export const videos: Video[] = [
  study({
    id: "miami-frequency",
    title: "Miami, in Frequency",
    description:
      "Start at the water’s edge. A short visual essay on the idea of Miami as a meeting point: moving light, layered rhythms and a city with more than one story.",
    category: "Music",
    places: ["miami"],
    period: "now",
    people: [],
    duration: 32.128,
    poster: "/media/miami.webp",
    series: "City Signals",
    episode: 1,
    context:
      "Preview collection · original motion study. Abstract animation and newly composed sound illustrate an editorial idea; this is not a recorded Miami performance or a finished Monumental Original.",
    tags: ["preview", "motion study", "city signals", "rhythm", "waterfront"],
  }),
  study({
    id: "concrete-and-colour",
    title: "Concrete & Colour",
    description:
      "Curves, symmetry and the optimism of a line. A concise illustrated introduction to Miami Beach’s Art Deco architecture and its 1930s context.",
    category: "Art & Design",
    places: ["miami"],
    period: "1930s",
    people: [],
    duration: 31.953,
    poster: "/media/deco.svg",
    series: "Time Studies",
    episode: 1,
    context:
      "Created in 2026 about the 1930s. Original abstract animation illustrates architectural ideas, not a reconstruction or historical footage. Miami Beach is a separate municipality within Greater Miami.",
    tags: [
      "preview",
      "motion study",
      "architecture",
      "art deco",
      "history",
      "miami beach",
    ],
  }),
  study({
    id: "island-current",
    title: "Island Current",
    description:
      "Rhythm carries stories. An illustrated doorway into Puerto Rico’s bomba and plena traditions, and the difference between a conversation in movement and a story in song.",
    category: "Culture",
    places: ["puerto-rico"],
    period: "now",
    people: [],
    duration: 33.213,
    poster: "/media/puerto-rico.webp",
    series: "City Signals",
    episode: 2,
    context:
      "A contemporary editorial introduction with original animation and synthetic sound. The soundtrack is an abstract score, not an authentic bomba or plena performance. Photograph: Old San Juan.",
    tags: [
      "preview",
      "motion study",
      "city signals",
      "bomba",
      "plena",
      "rhythm",
      "caribbean",
    ],
  }),
  study({
    id: "break-beat-city",
    title: "The Break / The Beginning",
    description:
      "A party becomes a point of departure. This illustrated essay introduces the Bronx context of hip-hop’s early years and the power of making something new together.",
    category: "Music",
    places: ["new-york"],
    period: "1970s",
    people: ["DJ Kool Herc"],
    duration: 29.293,
    poster: "/media/breakbeat.svg",
    series: "Time Studies",
    episode: 2,
    context:
      "Contemporary illustration concerning the 1970s, not archival material. DJ Kool Herc is discussed in historical context and does not appear or endorse this preview. No historic recordings are used.",
    tags: ["preview", "motion study", "hip-hop", "bronx", "history", "rhythm"],
  }),
  study({
    id: "london-after-hours",
    title: "London After Hours",
    description:
      "A signal finds its people. An illustrated micro-documentary about the connections between east London’s music spaces, pirate radio and the sounds of the early 1990s.",
    category: "Documentary",
    places: ["london"],
    period: "1990s",
    people: [],
    duration: 31.948,
    poster: "/media/london.webp",
    series: "Time Studies",
    episode: 3,
    context:
      "Newly created editorial animation about a historical period. The abstract score is not a historical broadcast, jungle recording or recording from any named venue. Gateway photograph is a contemporary London skyline, not 1990s archival material.",
    tags: [
      "preview",
      "motion study",
      "pirate radio",
      "jungle",
      "history",
      "rhythm",
    ],
  }),
  study({
    id: "tokyo-in-motion",
    title: "Tokyo / In Your Own Image",
    description:
      "Clothing can be a language before a word is spoken. An illustrated study inspired by Harajuku’s culture of street fashion and individual expression.",
    category: "Fashion",
    places: ["tokyo"],
    period: "now",
    people: [],
    duration: 32.853,
    poster: "/media/tokyo.webp",
    series: "City Signals",
    episode: 3,
    context:
      "An original abstract motion study, not runway footage or a documentary of a particular designer. Gateway photograph depicts Shinjuku; the narrated cultural context concerns Harajuku.",
    tags: [
      "preview",
      "motion study",
      "city signals",
      "streetwear",
      "harajuku",
      "self-expression",
    ],
  }),
  study({
    id: "rio-rhythm",
    title: "Rio, a Shared Rhythm",
    description:
      "Rhythm moves with people. A short illustrated introduction to the relationship between Bahia’s samba de roda and the evolution of urban samba in Rio.",
    category: "Culture",
    places: ["rio"],
    period: "now",
    people: [],
    duration: 31.518,
    poster: "/media/rio.webp",
    series: "City Signals",
    episode: 4,
    context:
      "An editorial motion study with contemporary abstract visuals. It does not claim to document a performance or a particular community. The original synthetic score is not an authentic samba recording.",
    tags: [
      "preview",
      "motion study",
      "city signals",
      "samba",
      "bahia",
      "rhythm",
    ],
  }),
  study({
    id: "shared-table",
    title: "The Shared Table",
    description:
      "A table can be a place of arrival. An original visual poem about recipes, memory and the connections we make through food, curated into the Miami gateway.",
    category: "Food",
    places: ["miami"],
    period: "now",
    people: [],
    duration: 33.078,
    poster: "/media/table.svg",
    series: "City Signals",
    episode: 5,
    context:
      "A fictional visual poem associated editorially with Miami’s cultural gateway. It does not depict a real restaurant, chef, recipe or cultural food tradition. Original abstract animation and score.",
    tags: [
      "preview",
      "motion study",
      "city signals",
      "food",
      "community",
      "memory",
    ],
  }),
  {
    id: "big-buck-bunny",
    title: "Big Buck Bunny · Trailer",
    description:
      "Meet a gentle giant with a very short temper in the official trailer for Blender Foundation’s 2008 animated comedy. A guest selection from open cinema.",
    category: "Film",
    places: [],
    period: "2000s",
    publishedAt: "2008-03-18",
    people: ["Sacha Goedegebure", "Blender Foundation"],
    duration: 33.042,
    poster: "/media/big-buck-bunny.jpg",
    src: "/media/big-buck-bunny.mp4",
    access: "free",
    status: "available",
    credit:
      "© Blender Foundation | peach.blender.org. Creative Commons Attribution 3.0. Official trailer, presented with its original identity and credits.",
    context:
      "Open cinema guest selection. Fictional animation; no real-world destination association. The period refers to its 2008 release, not the story’s setting. Not a Monumental Original.",
    tags: ["preview", "trailer", "open cinema", "animation", "comedy"],
  },
  {
    id: "sintel",
    title: "Sintel · Trailer",
    description:
      "A young traveller, an unlikely friendship and a vast imagined world. The official trailer for the 2010 Blender Foundation fantasy short, directed by Colin Levy.",
    category: "Film",
    places: [],
    period: "2010s",
    publishedAt: "2010-05-12",
    people: ["Colin Levy", "Blender Foundation"],
    duration: 52.208,
    poster: "/media/sintel.jpg",
    src: "/media/sintel.mp4",
    access: "free",
    status: "available",
    credit:
      "© Blender Foundation | www.sintel.org. Creative Commons Attribution 3.0. Official trailer, presented with its original identity and credits.",
    context:
      "Open cinema guest selection. Fantasy animation with no real-world destination association. The period refers to its 2010 release, not a historical story setting. Contains fantasy action. Not a Monumental Original.",
    tags: ["preview", "trailer", "open cinema", "animation", "fantasy"],
  },
  {
    id: "big-buck-bunny-full",
    title: "Big Buck Bunny",
    description:
      "A gentle woodland giant decides he has had enough of three troublesome neighbours. Watch Blender Foundation’s complete 2008 animated comedy, directed by Sacha Goedegebure.",
    category: "Film",
    places: [],
    period: "2000s",
    publishedAt: "2018-10-27",
    people: ["Sacha Goedegebure", "Blender Foundation"],
    duration: 596.566,
    poster: "/media/big-buck-bunny.jpg",
    src: "https://video.blender.org/object-storage/web_videos/bf1f3fb5-b119-4f9f-9930-8e20e892b898-720.mp4",
    access: "free",
    status: "available",
    credit:
      "© Blender Foundation | peach.blender.org. Creative Commons Attribution 3.0. Complete original film, streamed from Blender’s official server with original credits intact.",
    context:
      "Open cinema guest selection · complete film. Originally released in 2008; Published records this official streaming edition’s 2018 upload. Fictional animation with no destination association. Requires an internet connection. The separately listed local trailer is also available.",
    tags: ["preview", "full film", "open cinema", "animation", "comedy"],
  },
  {
    id: "sintel-full",
    title: "Sintel",
    description:
      "A lonely young woman befriends a wounded dragon and begins a journey that will change her life. Colin Levy’s complete 2010 fantasy short from Blender Foundation.",
    category: "Film",
    places: [],
    period: "2010s",
    publishedAt: "2018-10-26",
    people: ["Colin Levy", "Blender Foundation"],
    duration: 888.093,
    poster: "/media/sintel.jpg",
    src: "https://video.blender.org/object-storage/web_videos/0eb052d0-fd51-43e6-aa33-ecdbf77a5d40-720.mp4",
    access: "free",
    status: "available",
    credit:
      "© Blender Foundation | www.sintel.org. Creative Commons Attribution 3.0. Complete original film, streamed from Blender’s official server with original credits intact.",
    context:
      "Open cinema guest selection · complete film. Originally released in 2010; Published records this official streaming edition’s 2018 upload. Fictional fantasy with action and themes of loss; no real destination or historical setting is claimed. Requires an internet connection.",
    tags: ["preview", "full film", "open cinema", "animation", "fantasy"],
  },
  {
    id: "wavemakers-valid-id",
    title: "Valid ID presents WAVEMAKERS: Puerto Rico, New York to London",
    description:
      "The planned opening chapter of WAVEMAKERS, introduced by inaugural presenter and featured artist Valid ID. Better Late Than Never, Valid ID’s EP, anchors the opening artist campaign. Follow the geographical journey from Puerto Rico through New York to London.",
    category: "Music",
    places: ["puerto-rico", "new-york", "london"],
    period: "now",
    publishedAt: "",
    people: ["Valid ID"],
    duration: 0,
    poster: "/media/wavemakers.svg",
    access: "free",
    status: "development",
    series: "WAVEMAKERS",
    credit:
      "Monumental Streams · planned original programming. Concept artwork only; no approved artist photography or finished media supplied.",
    context:
      "In development. No finished episode, trailer, release date or runtime is available. Miami is the platform’s opening gateway; it does not replace this programme’s Puerto Rico → New York → London journey.",
    tags: [
      "originals",
      "in development",
      "better late than never",
      "wavemakers",
      "music",
      "borders",
    ],
  },
  {
    id: "story-behind-the-story",
    title: "THE STORY BEHIND THE STORY",
    description:
      "A planned original series about the decisions, relationships, setbacks and turning points behind significant work. The moments that change the work—and the people who make it.",
    category: "Documentary",
    places: [],
    period: "now",
    publishedAt: "",
    people: [],
    duration: 0,
    poster: "/media/story.svg",
    access: "premium",
    status: "development",
    series: "THE STORY BEHIND THE STORY",
    credit:
      "Monumental Streams · planned original programming. Original concept artwork.",
    context:
      "In development. Premium is a proposed programming position, not an available paid benefit. No episodes, subjects, release date or price have been approved.",
    tags: ["originals", "in development", "creative process", "relationships"],
  },
];


