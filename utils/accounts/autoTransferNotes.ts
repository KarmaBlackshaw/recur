export function autoTransferNotes(source: string, destination: string, isBillPayment: boolean) {
  if (isBillPayment) {
    return {
      outgoing: `${destination} bill payment`,
      incoming: `Paid from ${source}`,
      fee: `Fee for ${destination} bill payment`,
    };
  }
  return {
    outgoing: `Transfer to ${destination}`,
    incoming: `Transfer from ${source}`,
    fee: `Fee for transfer to ${destination}`,
  };
}
