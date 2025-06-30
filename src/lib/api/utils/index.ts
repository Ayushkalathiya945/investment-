import type { JwtPayload } from "jsonwebtoken";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import env from "@/env";

export function generateToken(payload: object, expiresIn: any = "24h") {
    const token = jwt.sign(
        payload,
        env.JWT_SECRET,
        { expiresIn },
    );

    return token;
}

export function verifyToken(token: string) {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    return decoded;
}

export function hashPassword(password: string) {
    return bcrypt.hash(password, 10);
}

export function comparePassword(password: string, hashedPassword: string) {
    return bcrypt.compare(password, hashedPassword);
}
