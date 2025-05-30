
  import { PrismaClient } from "@prisma/client";
  const prisma = new PrismaClient();

export interface currency_details {
    currencyCode: string;
    minimumAmount: number;
  }
  
  export const COUNTRY_MINIMUMS: Record<string, currency_details> = {
    USA: { currencyCode: 'USD', minimumAmount: 5 },
    NIGERIA: { currencyCode: 'NGN', minimumAmount: 500 },
    GERMANY: { currencyCode: 'EUR', minimumAmount: 3 },
    UK: { currencyCode: 'GBP', minimumAmount: 4 },
    CANADA: { currencyCode: 'CAD', minimumAmount: 5 },
    AUSTRALIA: { currencyCode: 'AUD', minimumAmount: 5 },
    JAPAN: { currencyCode: 'JPY', minimumAmount: 500 },
    CHINA: { currencyCode: 'CNY', minimumAmount: 30 },
    FRANCE: { currencyCode: 'EUR', minimumAmount: 3 },
    ITALY: { currencyCode: 'EUR', minimumAmount: 3 },
    INDIA: { currencyCode: 'INR', minimumAmount: 300 },
    BRAZIL: { currencyCode: 'BRL', minimumAmount: 10 },
    MEXICO: { currencyCode: 'MXN', minimumAmount: 100 },
    SOUTH_KOREA: { currencyCode: 'KRW', minimumAmount: 5000 },
    SOUTH_AFRICA: { currencyCode: 'ZAR', minimumAmount: 50 },
    RUSSIA: { currencyCode: 'RUB', minimumAmount: 200 },
    ARGENTINA: { currencyCode: 'ARS', minimumAmount: 300 },
    UAE: { currencyCode: 'AED', minimumAmount: 20 },
    SINGAPORE: { currencyCode: 'SGD', minimumAmount: 5 },
    SWEDEN: { currencyCode: 'SEK', minimumAmount: 30 },
    NETHERLANDS: { currencyCode: 'EUR', minimumAmount: 3 },
    SWITZERLAND: { currencyCode: 'CHF', minimumAmount: 3 },
    BELGIUM: { currencyCode: 'EUR', minimumAmount: 3 },
    AUSTRIA: { currencyCode: 'EUR', minimumAmount: 3 },
    POLAND: { currencyCode: 'PLN', minimumAmount: 10 },
    NEW_ZEALAND: { currencyCode: 'NZD', minimumAmount: 5 },
    MALAYSIA: { currencyCode: 'MYR', minimumAmount: 15 },
    PHILIPPINES: { currencyCode: 'PHP', minimumAmount: 250 },
    THAILAND: { currencyCode: 'THB', minimumAmount: 150 },
    INDONESIA: { currencyCode: 'IDR', minimumAmount: 75000 },
    VIETNAM: { currencyCode: 'VND', minimumAmount: 100000 },
    EGYPT: { currencyCode: 'EGP', minimumAmount: 80 },
    TURKEY: { currencyCode: 'TRY', minimumAmount: 50 },
    COLOMBIA: { currencyCode: 'COP', minimumAmount: 20000 },
    PERU: { currencyCode: 'PEN', minimumAmount: 20 },
    CHILE: { currencyCode: 'CLP', minimumAmount: 2000 },
    KENYA: { currencyCode: 'KES', minimumAmount: 500 },
    NIGER: { currencyCode: 'XOF', minimumAmount: 3000 },
    UGANDA: { currencyCode: 'UGX', minimumAmount: 15000 },
    ZAMBIA: { currencyCode: 'ZMK', minimumAmount: 100 },
    MALAWI: { currencyCode: 'MWK', minimumAmount: 10000 },
    GHANA: { currencyCode: 'GHS', minimumAmount: 30 },
    TAIWAN: { currencyCode: 'TWD', minimumAmount: 200 },
    HONG_KONG: { currencyCode: 'HKD', minimumAmount: 30 },
    ISRAEL: { currencyCode: 'ILS', minimumAmount: 15 },
    SAUDI_ARABIA: { currencyCode: 'SAR', minimumAmount: 20 },
    QATAR: { currencyCode: 'QAR', minimumAmount: 20 },
    KUWAIT: { currencyCode: 'KWD', minimumAmount: 2 },
    BAHRAIN: { currencyCode: 'BHD', minimumAmount: 2 },
    OMAN: { currencyCode: 'OMR', minimumAmount: 1 },
    LEBANON: { currencyCode: 'LBP', minimumAmount: 30000 },
    MOROCCO: { currencyCode: 'MAD', minimumAmount: 50 },
    ALGERIA: { currencyCode: 'DZD', minimumAmount: 500 },
    LIBYA: { currencyCode: 'LYD', minimumAmount: 10 },
    TUNISIA: { currencyCode: 'TND', minimumAmount: 20 },
  };
  
  export const get_minimum_transfer_amount = (country: string): number => {
    const country_formatted = country.toUpperCase().replace(/ /g, '_'); // Handle spaces and case
    return COUNTRY_MINIMUMS[country_formatted]?.minimumAmount || 1; // default fallback to 1
  };
  


  
  // Generate a unique account number (10 digits)
  export const generate_account_number = async (): Promise<string> => {
    // Generate a random 10-digit number
    const prefix = Date.now().toString().slice(-2);
    const random_num = prefix + Math.floor(10000000 + Math.random() * 90000000).toString();
    
    return random_num;
  };