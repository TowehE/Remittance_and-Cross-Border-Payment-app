import express from 'express'
import morgan from 'morgan'
import cors from 'cors'
import helmet from 'helmet'
import user_routes from './user-service/user.routes'
import rate_routes from './rate-service/rate_routes'
import { errorHandler } from './shared/middleware/error_middleware'
import payment_routes from './payment-service/payment_routes'
// import {PORT} from '../src/shared/config'

const app = express()


// middleware
app.use(helmet());
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }))
app.use(morgan('combined'));

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
app.use('/api/v1/auth', user_routes);
app.use('/api/v1/rates', rate_routes);
app.use('/api/v1/payment', payment_routes);

app.use(errorHandler);


// // Start server
// const server = app.listen(PORT, () => {
//   console.log(`API Gateway running on port ${PORT}`);
// });

export default app;