// A small seeded random number generator (mulberry32): the same seed gives the same
// city and the same traffic, which is what makes the screenshot scenes repeatable.

export function createRandom(seed) {
  let state = seed | 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** An integer in [min, max] from the seeded stream. */
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** One element of `items`, chosen from the seeded stream. */
export function randomPick(random, items) {
  return items[Math.floor(random() * items.length)];
}

/** Fisher-Yates shuffle of a copy, from the seeded stream. */
export function shuffled(random, items) {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    const held = copy[index];
    copy[index] = copy[other];
    copy[other] = held;
  }
  return copy;
}
