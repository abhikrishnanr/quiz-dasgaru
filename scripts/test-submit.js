const https = require('https');

const SECRET = 'SR!#$%^&TYUIA8I';
const API_HOST = 'kl7nxtkfbc.execute-api.ap-south-1.amazonaws.com';
const SESSION_ID = 'TEST2';
const QUESTION_ID = 'Q1';
const TEAM_ID = 'test-team-script-1';

// We need to register a team first to make sure it exists
async function registerTeam() {
    return new Promise((resolve) => {
        const options = {
            hostname: API_HOST,
            path: `/session/${SESSION_ID}/team/register`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                console.log('Register:', res.statusCode, data);
                if (res.statusCode === 200) {
                    const json = JSON.parse(data);
                    resolve({ teamId: json.teamId, teamSecret: json.teamSecret });
                } else {
                    resolve({ teamId: TEAM_ID, teamSecret: 'dummy' });
                }
            });
        });
        req.write(JSON.stringify({ teamName: 'Submit Test Team ' + Date.now() }));
        req.end();
    });
}

function makeRequest(path, body) {
    return new Promise((resolve) => {
        const options = {
            hostname: API_HOST,
            path: path,
            method: 'POST',
            headers: {
                'x-admin-secret': SECRET,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log(`[POST ${path}] Status: ${res.statusCode}`);
                console.log(`Body: ${data}`);
                resolve(res.statusCode);
            });
        });

        req.write(JSON.stringify(body));
        req.end();
    });
}

async function run() {
    // 1. Register
    const { teamId, teamSecret } = await registerTeam();
    console.log('Using Team ID:', teamId, 'Secret:', teamSecret);

    if (!teamSecret || teamSecret === 'dummy') {
        console.error('Failed to get valid team secret. Aborting valid submission tests.');
        return;
    }

    // 2. Try POST /answer (Singular) with VALID secret
    console.log('\n--- Test: Singular /answer (Valid) ---');
    const status = await makeRequest(`/session/${SESSION_ID}/answer`, {
        teamId: teamId,
        teamSecret: teamSecret,
        questionId: QUESTION_ID,
        selectedKey: "A"
    });

    if (status === 200 || status === 409) {
        console.log('SUCCESS: Endpoint reached and processed request (200 or 409 is expected).');
    } else {
        console.error('FAILURE: Unexpected status code:', status);
    }
}

run();
