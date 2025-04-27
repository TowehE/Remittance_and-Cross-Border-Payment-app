import { PrismaClient } from "@prisma/client";
import { customError, redisClient } from "../shared/middleware/error_middleware";
import axios from "axios";
import { fetch_all_exchange_rate_from_api } from "../api-gateway/exchangerate_integration";
import { cache_rate, get_cached_rate } from "./redis.service";

const prisma = new PrismaClient();

export interface ExchangeRateData {
    sourceCurrency: string;
    targetCurrency: string;
    rate: number;
  }

export const get_exchange_rate = async ( sourceCurrency: string, targetCurrency: string) =>{

  const cached_rate= await get_cached_rate(sourceCurrency, targetCurrency)
  
    if (cached_rate) {
        return JSON.parse(cached_rate);
        
      } 

const exchange_rate = await prisma.exchangeRate.findUnique({
    where: {
        sourceCurrency_targetCurrency: {
            sourceCurrency,
            targetCurrency
        } 
    }
})

if(exchange_rate){
    await cache_rate(sourceCurrency, targetCurrency, exchange_rate);
    return exchange_rate
  }
  const rate = await fetch_all_exchange_rate_from_api(sourceCurrency, targetCurrency)

  const new_exchange_rate = await prisma.exchangeRate.upsert({
    where: {
        sourceCurrency_targetCurrency: {
          sourceCurrency,
          targetCurrency
        }
      },
      update: {
        rate,
        lastUpdated: new Date()
      },
      create: {
        sourceCurrency,
        targetCurrency,
        rate
      }
  })

  await cache_rate(sourceCurrency, targetCurrency, new_exchange_rate);
  
  return new_exchange_rate;
};


export const calculate_transfer_amount = async(
    amount: number,
    sourceCurrency: string,
    targetCurrency: string
)=> {
    const exchange_rate = await get_exchange_rate (sourceCurrency, targetCurrency)

     // Calculate fees (for example, 1.5% of the amount)
    const fee_percentage = 0.015
    const fees = amount * fee_percentage

// Calculate target amount after fees
const target_amount = (amount - fees) * exchange_rate.rate

return {
    sourceAmount: amount,
    targetAmount: target_amount,
    fees,
    rate: exchange_rate.rate,
    sourceCurrency,
    targetCurrency
  };
};











