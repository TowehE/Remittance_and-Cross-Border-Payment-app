 import { PrismaClient } from "@prisma/client";
import { customError } from "../shared/middleware/error_middleware";
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken";
import { JWT_EXPIRES_IN, JWT_SECRET } from "../shared/config";
import { Secret, SignOptions } from "jsonwebtoken";
import { create_dedicated_account } from "../api-gateway/paystack.integration";
import { create_stripe_account } from "../api-gateway/stripe_integration";

const prisma = new PrismaClient()

export interface user_registration_data{
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    userType: 'international' | 'local'; 
    country?: string;
}



export interface user_login_data {
    email: string;
    password: string;
  }

export const register_user = async (user_data : user_registration_data) => {
    const existing_user = await prisma.user.findUnique({
        where: { email: user_data.email }

    })
if (existing_user){
    throw new customError ("User with this email already exists", 400)
}


const salt = await bcrypt.genSalt(10)
const hashed_password = await bcrypt.hash(user_data.password, salt)

 // Determine if user is international based on userType field
 const isInternational = user_data.userType === 'international';


 return await prisma.$transaction(async (prisma: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => {
// create a new user
const new_user = await prisma.user.create({
    data:{
        firstName: user_data.firstName,
        lastName: user_data.lastName,
        email: user_data.email,
        password: hashed_password,
        phoneNumber: user_data.phoneNumber,
        country: user_data.country || (isInternational ? 'Unknown' : 'Nigeria'),
        userType: user_data.userType
    },
        
})


 // Create accounts based on user type
 if (!isInternational) {


const dedicated_account = await create_dedicated_account({
    customer:  new_user.id,
    email: new_user.email,
    preferred_bank: "test-bank", 
    firstName: new_user.firstName,
    lastName: new_user.lastName,
    phoneNumber: new_user.phoneNumber ?? undefined,
  });


  await prisma.account.create({
    data: {
      userId: new_user.id,
      accountNumber: dedicated_account.account_number,
      balance: 0,
      currency: "NGN",
      provider: "paystack",
      isDefault: true
    }
  });



} else {
    // For international users - use Stripe
    const stripe_customer = await create_stripe_account({
      email: new_user.email,
      name: `${new_user.firstName} ${new_user.lastName}`,
      phone: new_user.phoneNumber
    });

    
      // Create USD account with Stripe
      await prisma.account.create({
        data: {
          userId: new_user.id,
          accountNumber: stripe_customer.id, 
          externalId: stripe_customer.id,  
          balance: 0,
          currency: "USD",
          provider: "stripe",
          isDefault: true
        }
      })
    }
// Genenrate a JWT 
const token = jwt.sign(
    { user_id: new_user.id, email: user_data.email },
    JWT_SECRET as Secret,
    { expiresIn: JWT_EXPIRES_IN } as SignOptions
  );

const { password, ...user_without_password } = new_user;

const user_with_account = await prisma.user.findUnique({
    where: { id: new_user.id },
    include: { accounts: true }
  });
  
  return {
    user: user_with_account,
    token
};
});
};




export const login = async (user_data: user_login_data) =>{
    const user = await prisma.user.findUnique({
        where: { email: user_data.email },
        include: {
          accounts: true
        }
      })
if (!user){
    throw new customError ("User does not exists", 400)
}

 // Verify password
 

  // Generate a JWT 
const token = jwt.sign(
    { user_id: user.id, email: user_data.email },
    JWT_SECRET as Secret,
    { expiresIn: JWT_EXPIRES_IN } as SignOptions
  );

  
  // Remove password from returned user object
  const { password, ...user_without_password } = user;
  
  return {
    user: user_without_password,
    token
  };
  
};





export const update_user_profile = async (userId: string, update_user_data: { password: string }) => {

    if (!userId) {
        throw new customError("User ID is required", 400); 
      } 
    if (!update_user_data.password) {
      throw new customError("Only password update is allowed", 400);
    }

    
  
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(update_user_data.password, salt);
  
    const updated_user = await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword
      },
      include: {
        accounts: true
      }
    });
  
  
    const { password, ...user_without_password } = updated_user;
  
    return user_without_password;
  };
  

export const get_all_users_admin = async () => {
  const users = await prisma.user.findMany({
    include: {
      accounts: true
    }
  });

  return users.map(user => {
    const { password, ...user_without_password } = user;
    return user_without_password;
  });
};


export const fund_user_wallet = async (userId: string, amount: number) => {
  if (!userId) {
    throw new customError("User ID is required", 400);
  }
  if (amount <= 0) {
    throw new customError("Amount must be greater than zero", 400);
  }
  
 
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { accounts: true }
  });

  if (!user) {
    throw new customError("User not found", 404);
  }

  // Assuming the first account is the default one
  const default_account = user.accounts[0];
  
  if (!default_account) {
    throw new customError("No account found for this user", 404);
  }

  const updated_account = await prisma.account.update({
    where: { id: default_account.id },
    data: { balance: { increment: amount } }
  });

  return updated_account;
};