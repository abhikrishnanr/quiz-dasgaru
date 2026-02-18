const https = require('https');

const SECRET = 'SR!#$%^&TYUIA8I';
const API_HOST = 'kl7nxtkfbc.execute-api.ap-south-1.amazonaws.com';
const SESSION_ID = 'TEST2';
const TEAM_ID = 'test-team-script-1';

const endpoints = [
    { method: 'PUT', path: `/session/${SESSION_ID}/team/${TEAM_ID}`, body: { teamName: 'Script Team 1' } },
    { method: 'POST', path: `/session/${SESSION_ID}/team`, body: { teamName: 'Script Team 2' } },
    { method: 'POST', path: `/session/${SESSION_ID}/teams`, body: { teamName: 'Script Team 3' } },
    { method: 'POST', path: `/session/${SESSION_ID}/team/register`, body: { teamName: 'Script Team Register' } },
    { method: 'POST', path: `/session/${SESSION_ID}/join`, body: { teamName: 'Script Team 4' } },
    { method: 'POST', path: `/session/${SESSION_ID}/participant`, body: { teamName: 'Script Team 5' } }
];

function makeRequest(opts) {
    return new Promise((resolve) => {
        const options = {
            hostname: API_HOST,
            path: opts.path,
            method: opts.method,
            headers: {
                'x-admin-secret': SECRET,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log(`[${opts.method} ${opts.path}] Status: ${res.statusCode} | Body: ${data.substring(0, 100)}`);
                resolve();
            });
        });

        req.on('error', (e) => {
            console.error(`[${opts.method} ${opts.path}] Error: ${e.message}`);
            resolve();
        });

        if (opts.body) {
            req.write(JSON.stringify(opts.body));
        }
        req.end();
    });
}

async function run() {
    console.log('Starting Endpoint Probe...');
    for (const ep of endpoints) {
        await makeRequest(ep);
    }
}

run();
