export function groupChatsByDate<T extends { updatedAt: Date }>(chats: T[]) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const yesterday = new Date(startOfToday);
  yesterday.setDate(yesterday.getDate() - 1);
  const last7 = new Date(startOfToday);
  last7.setDate(last7.getDate() - 7);
  const last30 = new Date(startOfToday);
  last30.setDate(last30.getDate() - 30);

  const buckets = [
    { label: "Today", chats: [] as T[], after: startOfToday },
    { label: "Yesterday", chats: [] as T[], after: yesterday },
    { label: "Previous 7 days", chats: [] as T[], after: last7 },
    { label: "Previous 30 days", chats: [] as T[], after: last30 },
    { label: "Older", chats: [] as T[], after: new Date(0) },
  ];

  for (const chat of chats) {
    const bucket = buckets.find((b) => new Date(chat.updatedAt) >= b.after);
    (bucket ?? buckets[buckets.length - 1]).chats.push(chat);
  }

  return buckets.filter((b) => b.chats.length > 0);
}