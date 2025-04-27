import express  from "express";
import *  as user_controller from "./user_controller"
import { auth_middleware } from "../shared/middleware/auth_middleware";

const router = express.Router()

router.post('/register', user_controller.register)
router.post('/login', user_controller.login)
router.patch('/profile', auth_middleware, user_controller.update_user_profile);



export default router

