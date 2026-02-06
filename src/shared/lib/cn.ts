export function cn(...classNames: Array<string | false | undefined>) {
  return classNames.filter(Boolean).join(' ');
}
