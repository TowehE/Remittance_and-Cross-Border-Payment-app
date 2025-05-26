import express, { Application, Request, Response, NextFunction } from "express";
import morgan from 'morgan'
import cors from 'cors'
import helmet from 'helmet'
import user_routes from './user-service/user.routes'
import rate_routes from './rate-service/rate_routes'
import { errorHandler } from './shared/middleware/error_middleware'
import payment_routes from './payment-service/payment_routes'
import bodyParser from 'body-parser';
import webhook_routes from './payment-service/wehbook_route'
import { Request as ExpressRequest } from "express";

const app = express()


// middleware
app.use(morgan('combined'));
app.use(helmet());
app.use(cors());



// Middleware to parse raw body for the Stripe webhook
app.use('/api/v1/webhook/stripe', express.raw({ type: 'application/json' })); // Correctly set content type
// Extend the Request interface to include rawBody
interface RequestWithRawBody extends ExpressRequest {
  rawBody?: any;
}

// Middleware to add raw body to req object
app.use('/api/v1/webhook/stripe', (req: RequestWithRawBody, res: Response, next: NextFunction) => {
    if (req.headers["stripe-signature"]) {
        req.rawBody = req.body; // Use raw body for signature verification
    }
    next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }))



// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Home page
app.get('/', (req, res) => {
  res.status(200).json({ status: 'Remittance app is running', timestamp: new Date() });
});

app.get('/success', (req, res) => {
  res.send('Payment successful! Thank you for your payment.');
})

app.get('/cancel', (req, res) => {
  res.send('Payment was canceled. Please try again.');
})

// Routes
app.use('/api/v1/webhook', webhook_routes); 
app.use('/api/v1/auth', user_routes);
app.use('/api/v1/rates', rate_routes);
app.use('/api/v1/payment', payment_routes);


app.use(errorHandler);


export default app;