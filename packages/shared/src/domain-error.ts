export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(
    message: string,
    readonly httpStatus: number = 400,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
