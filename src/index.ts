
import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import app from './server';
import { start_scheduled_jobs } from './queue/test_queue';


const PORT = process.env.PORT || 4900
const prisma= new PrismaClient()

async function startServer() {
    try {
      await prisma.$connect(); 
      console.log('Connected to the database');
  
      app.listen(PORT, () => {
        console.log(`Payment service running on port ${PORT}`);
          start_scheduled_jobs();
      });
    } catch (error) {
      console.error('Failed to connect to the database:', error);
      process.exit(1); 
    }
  }


startServer();