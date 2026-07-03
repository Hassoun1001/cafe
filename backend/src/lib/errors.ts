export class AppError extends Error {
  statusCode: number;
  code?: string;
  details?: unknown;

  constructor(statusCode: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, code?: string, details?: unknown) =>
  new AppError(400, message, code, details);
export const unauthorized = (message = 'Unauthorized', code?: string) =>
  new AppError(401, message, code);
export const forbidden = (message = 'Forbidden', code?: string) => new AppError(403, message, code);
export const notFound = (message = 'Not found', code?: string) => new AppError(404, message, code);
export const conflict = (message: string, code?: string) => new AppError(409, message, code);
