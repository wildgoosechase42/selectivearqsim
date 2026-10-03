export function cn(...inputs) {
  return inputs
    .flat()
    .filter((x) => typeof x === 'string' && x.trim().length > 0)
    .join(' ');
}
