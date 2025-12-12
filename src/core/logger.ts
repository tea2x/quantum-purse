// logger.ts
import { IS_MAIN_NET } from './config';

const isNativeApp = process.env.NATIVE_APP === "true";

export function logger(type: "info" | "error", message: string): void {
    // no logging in production build
    if (isNativeApp && IS_MAIN_NET)
        return;

    if (type === "info") {
        console.log(`[INFO] ${new Date().toISOString()}: ${message}`);
    } else if (type === "error") {
        console.error(`[ERROR] ${new Date().toISOString()}: ${message}`);
    }
}