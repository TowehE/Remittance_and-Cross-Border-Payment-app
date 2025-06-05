import express from "express";
import { auth_middleware } from "../shared/middleware/auth_middleware";
import * as transaction_controller from "./transaction_controller"

const router = express.Router()

router.get('/fund-wallet', auth_middleware, transaction_controller.fund_user_wallet);
router.get('/balance', auth_middleware, transaction_controller.check_wallet_balance)


export default router