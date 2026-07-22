import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { AppError } from '../lib/errors';
import { config } from '../config';

export function notFoundMiddleware(req: Request, res: Response) {
  res.status(404).json({ error: { message: `No route: ${req.method} ${req.originalUrl}`, code: 'NOT_FOUND' } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { message: err.message, code: err.code, details: err.details } });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: err.flatten(),
      },
    });
    return;
  }

  // Thrown by multer's upload middleware (e.g. exceeding the fileSize limit)
  // before the route handler even runs — without this it fell through to the
  // generic 500 below with no useful message, which is what forced splitting
  // an oversized upload into smaller files just to find out why it failed.
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large — the limit is 25MB' : err.message;
    res.status(400).json({ error: { message, code: err.code } });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: { message: 'A record with that value already exists', code: 'DUPLICATE' } });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: { message: 'Record not found', code: 'NOT_FOUND' } });
      return;
    }
  }

  console.error(err);
  res.status(500).json({
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
      stack: config.isProduction ? undefined : err instanceof Error ? err.stack : undefined,
    },
  });
}
