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
    "Haanji, good morning. Chai bani ya sirf socha hai?",
    "Subah subah bugs dekhne ka bhi apna hi maza hai.",
    "Neend poori hui ya seedha keyboard pe aa gaye?",
    "Alarm snooze karke aaye ho ya genuinely fresh ho?",
    "Sabse pehla sawaal, chai ka cup kahan hai?",
    "Haanji, good morning. Fresh dimaag hai toh kuch naya seekh lo aaj.",
    "Subah ka time best hota hai concepts clear karne ke liye. Kya lekar baithe ho?",
    "Din shuru ho gaya, ek chhota sa target set karo aaj ke liye.",
    "Haanji, batao aaj kis topic pe focus karna hai.",
    "Naya din hai, purani confusion peeche chhodo aur aage badho.",
  ],

  afternoon: [
    "Lunch ke baad code likhna ya code dekh ke hi neend aa jaati hai?",
    "Haanji, dopahar ka slump hai ya genuinely stuck ho kisi bug mein?",
    "Itne dino se yeh tutorial dekh rahe ho ya kuch bana bhi rahe ho?",
    "Dopahar mein motivation dhoondne aaye ho, sahi jagah aaye ho.",
    "Chai dobara ban gayi ya ek hi cup mein pura din chalega?",
    "Haanji, batao aaj kaunsa problem solve karna hai.",
    "Aadha din nikal gaya, progress kaisa hai project pe?",
    "Dopahar mein bhi focus bana rakhna hi asli discipline hai.",
    "Kya atka hai, seedha bolo, sort kar lete hain.",
    "Haanji, kaam chal raha hai ya sirf planning mein hi din nikal gaya?",
  ],

  evening: [
    "Office se aaye ho ya seedha laptop khol ke baith gaye?",
    "Haanji, evening chai ke saath aaj kaunsa bug fry hoga?",
    "Din bhar ki thakaan, aur ab code bhi likhna hai. Josh hai kya?",
    "Sham ho gayi, tutorial list bhi lambi hui ya kuch complete hua?",
    "Haanji, aaj ka scene kya hai, seekhna hai ya build karna hai?",
    "Sham ka time hai, din ka hisaab lagao, kya seekha aaj?",
    "Haanji, thoda dhang se baitho aur batao kahan atke ho.",
    "Evening mein bhi consistency banaye rakhna hi farak dalta hai.",
    "Kaam khatam karke aaye ho, ab dimaag coding pe lagao.",
    "Haanji, batao aaj ka topic, dhyaan se sunte hain.",
  ],

  night: [
    "Raat ke 12 baje bhi bug zinda hai, himmat hai tumhari.",
    "Haanji, neend se zyada priority bug ko de rahe ho lagta hai.",
    "Itni raat ko coding, ya sirf Stack Overflow scroll ho raha hai?",
    "Raat wale coder alag hi breed hote hain, batao kya scene hai.",
    "Haanji, chai thandi ho gayi hogi ab, phir bhi lage raho.",
    "Der raat hai, par seekhna kabhi late nahi hota. Batao kya poochna hai.",
    "Haanji, thoda aaram bhi karo, par pehle batao kahan fase ho.",
    "Raat ko dimaag shant hota hai, isi liye concepts clear karne ka sahi time hai.",
    "Neend important hai, par pehle yeh bata do, kya solve karna hai.",
    "Haanji, der ho gayi hai, jaldi se batao problem kya hai.",
  ],
};


export const PIYUSH_GREETINGS = {
  morning: [
    "Morning bhai. Coffee done or still booting up?",
    "New day, same bugs waiting for you. What's the plan?",
    "Fresh morning, fresh commits. What are we pushing today?",
    "Alarm snoozed thrice and still made it here, respect. What's up?",
    "Morning energy is real, use it before the meetings kill it.",
    "Good morning. What's the problem statement for today?",
    "Let's use this fresh headspace well. What are you building?",
    "Morning is best for deep work, no distractions. What's on your plate?",
    "New day, new target. Tell me what you're shipping today.",
    "Let's start clean. What's blocking you right now?",
  ],

  afternoon: [
    "Post lunch coma hitting or you're actually coding?",
    "Afternoon slump is real, but bugs don't take a break. What's up?",
    "Still watching tutorials or actually building something, bhai?",
    "Half the day gone, coffee number two loading. What's the update?",
    "Dopahar mein bhi hustle chalu hai, nice. What are we solving?",
    "What's the current bottleneck? Let's break it down.",
    "Half day down, what's the progress on the project?",
    "Focus dips in the afternoon, discipline is what separates people. What's the task?",
    "Tell me the exact error, we'll fix it faster that way.",
    "Consistency through the day matters more than morning motivation. What's next?",
  ],

  evening: [
    "Office khatam, now the real coding shift starts, yes or no?",
    "Evening bugs hit different, what broke this time?",
    "Long day, laptop still open, that's dedication. What's cooking?",
    "Tutorial list getting longer or projects actually shipping?",
    "Evening grind mode on. What are we building tonight?",
    "Good evening. What did you actually learn today, be honest.",
    "End of day check in, what's the current status on your project?",
    "Evening consistency is what compounds over months. What's the plan tonight?",
    "Let's wrap the day with something shipped. What's left?",
    "What's the bottleneck right now, let's solve it before you log off.",
  ],

  night: [
    "Midnight debugging club, welcome. What's broken?",
    "Sleep can wait, bug can't, that's the mindset huh?",
    "Stack Overflow open in fifteen tabs, classic night coding. What's up?",
    "Still awake and shipping, that's the grind. What's the issue?",
    "Night owls write the best commits apparently. What are we fixing?",
    "Late night but let's make it count. What's the exact problem?",
    "Rest matters too, but first tell me what's stuck.",
    "Quiet hours are good for deep debugging. What's the error?",
    "Don't burn out chasing this at 2am, but let's solve it quick. What's up?",
    "Night session, keep it focused. What exactly needs fixing?",
  ],
};