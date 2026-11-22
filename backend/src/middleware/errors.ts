import type { ErrorRequestHandler } from 'express';

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error.';
  if (error instanceof HttpError) {
    ({ status, code, message } = error);
  } else if (error instanceof URIError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Invalid request input.';
  } else if (error instanceof Error && 'type' in error && 'status' in error) {
    if (error.type === 'entity.parse.failed' && error.status === 400) {
      status = 400;
      code = 'INVALID_JSON';
      message = 'Invalid JSON body.';
    } else if (error.type === 'entity.too.large' && error.status === 413) {
      status = 413;
      code = 'PAYLOAD_TOO_LARGE';
      message = 'Request body is too large.';
    } else if (error.status === 415 && (error.type === 'charset.unsupported' || error.type === 'encoding.unsupported')) {
      status = 415;
      code = 'UNSUPPORTED_ENCODING';
      message = 'Unsupported request encoding.';
    }
  }
  if (status === 500) console.error('Unhandled request error');
  response.status(status).json({ error: { code, message } });
};
