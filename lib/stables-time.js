// All reporting days and editor times use Sydney, including daylight saving.
export const ZONE = 'Australia/Sydney';
const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function localTime(value) {
  const p = Object.fromEntries(formatter.formatToParts(new Date(value)).map(p => [p.type, p.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export const dayKey = value => localTime(value).slice(0, 10);
export function shiftDay(day, amount) { return new Date(Date.parse(day + 'T12:00:00Z') + amount * 86400000).toISOString().slice(0, 10); }
export function fromLocal(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw Error('Enter a valid date and time.');
  const utc = Date.parse(value + 'Z');
  const matches = [10, 11].map(offset => utc - offset * 3600000).filter(time => Number.isFinite(time) && localTime(time) === value);
  if (matches.length !== 1) throw Error('This Sydney time is skipped or repeated by daylight saving. Choose another time.');
  return new Date(matches[0]).toISOString();
}
export const dayStart = day => Date.parse(fromLocal(day + 'T00:00'));
