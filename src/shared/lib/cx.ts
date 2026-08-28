/** Joins truthy class names with a space — for composing CSS-Modules-scoped classes. */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
