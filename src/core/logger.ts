// logger.ts
import { IS_MAIN_NET } from './config';

export function logger(type: "info" | "error", message: string): void {
    // No logging in production build
    if (IS_MAIN_NET)
        return;

    if (type === "info") {
        console.log(`[INFO] ${new Date().toISOString()}: ${message}`);
    } else if (type === "error") {
        console.error(`[ERROR] ${new Date().toISOString()}: ${message}`);
    }
}