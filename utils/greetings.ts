export function getGreeting(personaId: string) {
  const hour = new Date().getHours();

  const period =
    hour >= 5 && hour < 12
      ? "morning"
      : hour >= 12 && hour < 17
      ? "afternoon"
      : hour >= 17 && hour < 22
      ? "evening"
      : "night";

  const greetings =
    personaId === "hitesh"
      ? HITESH_GREETINGS[period]
      : PIYUSH_GREETINGS[period];

  return greetings[
    Math.floor(Math.random() * greetings.length)
  ];
}


export const HITESH_GREETINGS = {
  morning: [
    "Good morning. Chai ho gayi? Aaj kya bana rahe ho?",
    "Subah subah coding, mast. Kis cheez mein atke ho?",
    "Fresh dimaag ka best use hai coding. Batao kya karna hai.",
    "Morning mein concepts jaldi samajh aate hain. Kya seekhna hai aaj?",
  ],

  afternoon: [
    "Lunch ke baad thodi coding ho jaye?",
    "Chalo batao, aaj kya build kar rahe ho?",
    "Project pe kaam chal raha hai ya tutorial loop mein ho?",
    "Kis problem ko solve karna hai aaj?",
  ],

  evening: [
    "Good evening. Chai ready?",
    "Office ya college ke baad coding session?",
    "Aaj kya seekhna hai ya kya banana hai?",
    "Evening coding sessions alag hi maza dete hain.",
  ],

  night: [
    "Late night debugging session?",
    "Raat ke coding sessions kaafi productive hote hain.",
    "Chalo batao, kya toot gaya hai?",
    "Aaj bhi neend se zyada bugs important hain?",
  ],
};


export const PIYUSH_GREETINGS = {
  morning: [
    "Good morning. What are we building today?",
    "Fresh start. What's the problem statement?",
    "Morning coding sessions hit differently. What are you working on?",
    "Let's ship something today.",
  ],

  afternoon: [
    "Alright, what are we solving today?",
    "Show me the architecture problem.",
    "What's blocking your progress right now?",
    "Let's get this shipped.",
  ],

  evening: [
    "Good evening. What are we shipping today?",
    "Building something interesting?",
    "Let's see the problem statement.",
    "What's the current bottleneck?",
  ],

  night: [
    "Late night coding session?",
    "Night is when the real debugging starts.",
    "Still shipping at this hour? Respect.",
    "What's broken? Let's fix it.",
  ],
};