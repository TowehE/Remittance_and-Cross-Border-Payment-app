
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client';
import app from './server';

dotenv.config()

const PORT = process.env.PORT || 4900
const prisma= new PrismaClient()

async function startServer() {
    try {
      await prisma.$connect(); 
      console.log('Connected to the database');
  
      app.listen(PORT, () => {
        console.log(`Payment service running on port ${PORT}`);
      });
    } catch (error) {
      console.error('Failed to connect to the database:', error);
      process.exit(1); 
    }
  }


startServer();