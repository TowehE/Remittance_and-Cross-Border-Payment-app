import "express-session";

declare module "express-session" {
  interface SessionData {
    googleAccessToken?: string;  // Add googleAccessToken to SessionData
  }
}

declare module "express-serve-static-core" {
  interface Request {
    session?: Express.Session; // mark optional if not always present
    user?: any; // Replace any with your actual user type if you have one
    rawBody?: any; // Add rawBody to the Request type
  }
}