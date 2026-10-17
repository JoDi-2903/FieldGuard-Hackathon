// Renders "**word**" in a data string as bold, so key phrases can be marked in the data.
export function emphasize(text) {
  if (!text) return text;
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part));
}
