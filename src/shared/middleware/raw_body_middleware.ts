import { Request, Response, NextFunction } from 'express';

export interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

export const rawBodyMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const chunks: Buffer[] = [];

  req.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });

  req.on('end', () => {
    (req as RequestWithRawBody).rawBody = Buffer.concat(chunks);
    next();
  });

  req.on('error', (err) => {
    console.error('Error in raw body middleware:', err);
    next(err);
  });
};
