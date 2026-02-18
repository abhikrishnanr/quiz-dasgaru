const https = require('https');

const SECRET = 'SR!#$%^&TYUIA8I';
const API_HOST = 'kl7nxtkfbc.execute-api.ap-south-1.amazonaws.com';
const SESSION_ID = 'TEST2';

function makeRequest(path) {
    return new Promise((resolve) => {
        const options = {
            hostname: API_HOST,
            path: path,
            method: 'GET',
            headers: {
                'x-admin-secret': SECRET,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log(`[GET ${path}] Status: ${res.statusCode}`);
                try {
                    const json = JSON.parse(data);
                    if (json.teams && json.teams.length > 0) {
                        console.log('Use Team Secret:', json.teams[0].teamSecret);
                        console.log('Sample Team:', JSON.stringify(json.teams[0], null, 2));
                    } else {
                        console.log('No teams found or no secrets.');
                        console.log(data);
                    }
                } catch (e) {
                    console.log('Failed to parse:', data);
                }
                resolve();
            });
        });
        req.end();
    });
}

// Update team name to same name to see if it returns secret
const options = {
    hostname: API_HOST,
    path: `/session/${SESSION_ID}/team/T894A55`,
    method: 'PUT',
    headers: {
        'x-admin-secret': SECRET,
        'Content-Type': 'application/json'
    }
};
const req = https.request(options, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => console.log('PUT Response:', res.statusCode, data));
});
req.write(JSON.stringify({ teamName: 'Script Team Register Updated' }));
req.end();
