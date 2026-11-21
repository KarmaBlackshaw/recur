import { autoTransferNotes } from "@/utils/accounts/autoTransferNotes";

export function customTransferNote(note: string | null, source: string, destination: string) {
  const autoNotes = [false, true].flatMap((isBillPayment) => {
    const { outgoing, incoming } = autoTransferNotes(source, destination, isBillPayment);
    return [outgoing, incoming];
  });
  return note != null && autoNotes.includes(note) ? null : note;
}
