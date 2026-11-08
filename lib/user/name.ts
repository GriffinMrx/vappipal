/** First name for greetings: the first word of the name, else the email's local part (without +tags). */
export function firstName(user: { name: string | null; email: string }): string {
  const fromName = user.name?.trim().split(/\s+/)[0];
  return fromName || user.email.split("@")[0].split("+")[0];
}
