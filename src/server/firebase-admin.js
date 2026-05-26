/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('fs');
const path = require('path');

let cachedDb = null;
let cachedInitError = null;
let envLoaded = false;

function loadEnvConfigIfAvailable() {
    if (envLoaded) return;
    envLoaded = true;

    for (const fileName of ['.env.local', '.env']) {
        const filePath = path.join(process.cwd(), fileName);
        if (!fs.existsSync(filePath)) continue;
        const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
            const separatorIndex = trimmed.indexOf('=');
            const key = trimmed.slice(0, separatorIndex).trim();
            let value = trimmed.slice(separatorIndex + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (key && process.env[key] === undefined) {
                process.env[key] = value;
            }
        }
    }
}

function isFirebaseEnabled() {
    loadEnvConfigIfAvailable();
    return process.env.GAMEBOX_FIREBASE_ENABLED === '1';
}

function parseServiceAccountFromEnv() {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

    if (json) return JSON.parse(json);
    if (base64) return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
    return null;
}

function getFirebaseDb() {
    loadEnvConfigIfAvailable();
    if (!isFirebaseEnabled()) return null;
    if (cachedDb) return cachedDb;
    if (cachedInitError) return null;

    try {
        const { applicationDefault, cert, getApps, initializeApp } = require('firebase-admin/app');
        const { getFirestore } = require('firebase-admin/firestore');

        const projectId = process.env.GAMEBOX_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
        const serviceAccount = parseServiceAccountFromEnv();
        const appOptions = {};

        if (projectId) appOptions.projectId = projectId;
        if (serviceAccount) {
            appOptions.credential = cert(serviceAccount);
        } else if (!process.env.FIRESTORE_EMULATOR_HOST) {
            appOptions.credential = applicationDefault();
        }

        const app = getApps().length > 0 ? getApps()[0] : initializeApp(appOptions);
        cachedDb = getFirestore(app);
        return cachedDb;
    } catch (error) {
        cachedInitError = error;
        console.warn(`[Firebase] Firebase desativado nesta execucao: ${error.message}`);
        return null;
    }
}

function resetFirebaseForTests() {
    cachedDb = null;
    cachedInitError = null;
}

module.exports = {
    getFirebaseDb,
    isFirebaseEnabled,
    resetFirebaseForTests,
};
