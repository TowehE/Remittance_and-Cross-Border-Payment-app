import axios from 'axios';
import { customError } from '../shared/middleware/error_middleware';
import { EXCHANGE_RATE_BASE_URL } from '../shared/config';

export interface exchange_rate_api_response {
  rates: Record<string, number>;
}


export const fetch_all_exchange_rate_from_api = async (sourceCurrency: string, targetCurrency: string): Promise<number> => {
  try {
    const url = `${EXCHANGE_RATE_BASE_URL}/${sourceCurrency}`;
    // console.log('API Request URL:', url);
    const response = await axios.get<exchange_rate_api_response>(url);
    if (response.status !== 200) {
      throw new customError(`Failed to fetch exchange rate: ${response.statusText}`, 500);
    }
    const rates = response.data.rates;
    const target = rates[targetCurrency];
    
    if (!target) {
      throw new customError(`Exchange rate not available for ${sourceCurrency} to ${targetCurrency}`, 400);
    }
    
    return target;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new customError(`Failed to fetch exchange rate: ${error.message}`, 500);
    }
    throw error;
  }
};

export const fetch_all_exchange_rates = async (baseCurrency: string): Promise<Record<string, number>> => {
  try {
    const url = `${EXCHANGE_RATE_BASE_URL}/${baseCurrency}`;
    const response = await axios.get<exchange_rate_api_response>(url);
    
    return response.data.rates;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new customError(`Failed to fetch exchange rates: ${error.message}`, 500);
    }
    throw error;
  }
};
