import { Request, Response, NextFunction } from 'express';

// Define the extended request interface
export interface RequestWithRawBody extends Request {
  rawBody?: Buffer; 
}

export const rawBodyMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  let data = '';
  let rawBody = Buffer.alloc(0);
  

  // For raw Buffer handling
  req.on('data', (chunk) => {
    const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    rawBody = Buffer.concat([rawBody, chunkBuffer]);
    
    // Also collect as string for potential JSON parsing
    data += chunk.toString();
  });
  
  req.on('end', () => {
    // Assign raw body as Buffer
    (req as RequestWithRawBody).rawBody = rawBody;
    
    // If already parsed by express.json(), don't overwrite
    if (!req.body && req.headers['content-type']?.includes('application/json')) {
      try {
        req.body = JSON.parse(data);
      } catch (e) {
        // Parsing failed, continue anyway
      }
    }
    
    next();
  });
};