export function cn(...inputs: any[]): string {
  return inputs
    .flat()
    .filter((x) => typeof x === 'string' && x.trim().length > 0)
    .join(' ');
}
