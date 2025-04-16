export const getRandomItem = (items: string[]) => {
  const randomIndex = Math.floor(Math.random() * items.length);
  return items[randomIndex];
};
