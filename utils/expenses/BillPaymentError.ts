export class BillPaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillPaymentError";
  }
}
