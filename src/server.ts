import express, { Application, Request, Response, NextFunction } from "express";
import morgan from 'morgan'
import cors from 'cors'
import helmet from 'helmet'
import user_routes from './user/user.routes'
import rate_routes from './rate/rate_routes'
import { errorHandler } from './shared/middleware/error_middleware'
import payment_routes from './payment/payment_routes'
import webhook_routes from './api-gateway/wehbook_route';
import { Request as ExpressRequest } from "express";
import path from "path";
import transaction_routes from './transaction/transaction_routes'

const app = express()


declare module 'express-serve-static-core' {
  interface Request {
    rawBody?: any;
  }
}
interface RequestWithRawBody extends ExpressRequest {
  rawBody?: Buffer;
}


// middleware
app.use(morgan('combined'));
app.use(helmet());
app.use(cors());

// Middleware to parse raw body for the Paystack webhook
app.use('/api/v1/webhook/paystack', express.raw({ type: 'application/json' }));

// Middleware to add raw body to req object
app.use('/api/v1/webhook/paystack', (req: Request, res: Response, next: NextFunction) => {
    if (req.headers['x-paystack-signature']) {
        req.rawBody = req.body; // Use raw body for signature verification
    }
    next();
});

app.use('/api/v1/webhook/stripe', express.raw({ type: 'application/json' }));

// Middleware to add raw body to req object
app.use('/api/v1/webhook/stripe', (req: RequestWithRawBody, res: Response, next: NextFunction) => {
    if (req.headers["stripe-signature"]) {
      // Use raw body for signature verification
        req.rawBody = req.body; 
           console.log("Stripe raw body is buffer:", Buffer.isBuffer(req.rawBody)); 
    }
    console.log("Is rawBody a buffer:", Buffer.isBuffer(req.rawBody)); 
    next();
});


app.use(express.json());
app.use(express.urlencoded({ extended: true }))
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'src', 'views'));


// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Home page
app.get('/', (req, res) => {
  res.status(200).json({ status: 'Remittance app is running', timestamp: new Date() });
});

app.get('/success', (req, res) => {
  res.render('success')
})

app.get('/cancel', (req, res) => {
  res.render('cancel')
})

// Routes
app.use('/api/v1/webhook', webhook_routes); 
app.use('/api/v1/auth', user_routes);
app.use('/api/v1/rates', rate_routes);
app.use('/api/v1/payment', payment_routes);
app.use('/api/v1/balance', transaction_routes);


app.use(errorHandler);


export default app;