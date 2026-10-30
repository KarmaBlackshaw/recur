export function customTransferNote(note: string | null, source: string, destination: string) {
  const isAutoNote = note === `Transfer to ${destination}` || note === `Transfer from ${source}`;
  return isAutoNote ? null : note;
}
