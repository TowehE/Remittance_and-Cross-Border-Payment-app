import express  from "express";
import *  as user_controller from "./user_controller"
import { auth_middleware } from "../shared/middleware/auth_middleware";
import { login_rate_limiter } from "../shared/middleware/redis_rate_limits";

const router = express.Router()

router.post('/register', user_controller.register)
router.post('/login', login_rate_limiter, user_controller.login)
router.patch('/profile', auth_middleware, user_controller.update_user_profile);
router.get('/users', user_controller.get_all_users);




export default router

