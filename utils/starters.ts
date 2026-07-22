/**
 * Questions that exercise the course index, shown regardless of persona.
 *
 * Both personas answer from the same transcripts, and without these the empty
 * state advertises career advice only — nobody would think to ask where dynamic
 * routes are taught, so the retrieval pipeline would sit unused behind a chat box
 * that looks like every other chat box. Discoverability is the whole job here.
 *
 * The mix is deliberate: mostly COURSE questions that end in a cited timestamp,
 * plus a couple of CATALOG ones ("what's in module 5") so the structural route
 * gets found too.
 */
export const COURSE_STARTERS: string[] = [
  "How do I read params from a dynamic route in Expo Router?",
  "How do I store a login token securely in an Expo app?",
  "Show me how to pick an image from the phone's gallery",
  "What's the difference between Stack and Tabs navigation?",
  "How do I make the phone vibrate when someone taps a button?",
  "Where does this course cover authentication?",
  "How do I build an APK with EAS Build?",
  "Why would a FlatList scroll slowly, and how do I fix it?",
  "What's covered in module 5?",
  "How do I call an API and show the data on a screen?",
  "How do I use AsyncStorage to save data on the device?",
  "How do I ask for camera permissions the right way?",
];

export const STARTERS: Record<string, string[]> = {
  hitesh: [
    "I have no coding background, where do I even start in 2026?",
    "Everyone says learn React, but should I really jump straight to it?",
    "Is frontend or backend more future proof right now?",
    "Realistically, how many months of consistent coding before I'm job ready?",
    "I've built three todo apps, what should I actually put on my resume?",
    "Do I really need DSA if all I want is a web dev job?",
    "I keep losing motivation after a week, how do people actually stay consistent?",
    "What does a real full stack roadmap look like, not the YouTube version?",
    "Node, Django, or something else, which backend should a beginner pick?",
    "How much JavaScript is enough before I touch React?",
    "I have zero interview experience, how do I even prepare?",
    "What's that one mistake almost every beginner makes?",
    "Should I learn TypeScript now or wait till I'm comfortable with JS?",
    "I've watched fifty tutorials and built nothing, what's wrong with me?",
    "Is a CS degree actually required to get hired as a developer?",
    "My portfolio has only tutorial projects, how do I fix that?",
    "As a full stack dev, how much DevOps am I actually expected to know?",
    "With AI writing so much code now, what actually makes a developer stand out?",
    "How do I make myself worth hiring as an intern with zero real experience?",
    "I can write code but freeze at logic problems, how do I get better at that?",
  ],

  piyush: [
    "How do I actually structure a Node backend so it doesn't turn into spaghetti at scale?",
    "My app is growing, when do I actually need to move from SQL to NoSQL?",
    "What does proper auth look like in a real production app, not just a login form?",
    "How do multi tenant SaaS apps actually separate customer data under the hood?",
    "My APIs are slow under load, what caching strategy should I actually use?",
    "System design rounds scare me, how do I even approach one?",
    "How do I design APIs that won't break when traffic suddenly spikes?",
    "My Next.js app is getting messy, how should a large one actually be structured?",
    "How does rate limiting actually work in production, not just in theory?",
    "When does event driven architecture actually make sense over a normal REST setup?",
    "How do I know when a background job or queue is the right call?",
    "How would you actually design a notification system that scales to millions of users?",
    "My Postgres queries are crawling, how do I actually debug and optimize them?",
    "Is a monorepo actually worth the setup pain for a growing team?",
    "How do large platforms handle file uploads without falling over?",
    "What does horizontal scaling actually look like in practice, not just the buzzword?",
    "How do microservices actually talk to each other without turning into chaos?",
    "What does real observability look like in a production system?",
    "How do distributed transactions actually get handled without losing data?",
    "What's expected of me differently in a senior backend interview versus a mid level one?",
  ],
};
