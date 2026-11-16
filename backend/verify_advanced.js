const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function testAdvancedVerification() {
    try {
        // 1. Register a new student
        const email = `test_adv_${Date.now()}@example.com`;
        const password = 'password123';

        console.log(`Registering user: ${email}`);
        const registerRes = await axios.post(`${API_URL}/auth/register`, {
            email,
            password,
            role: 'STUDENT',
            full_name: 'Advanced Test Student'
        });

        const token = registerRes.data.token;
        console.log('Registration successful.');

        // 2. Test Green Zone (< 0.5km)
        console.log('\n--- Testing Green Zone ---');
        try {
            const greenRes = await axios.post(`${API_URL}/kyc/location-verify`, {
                lat: 12.9716, // Exact center
                lon: 77.5946,
                accuracy: 5,
                timestamp: new Date().toISOString(),
                device_id: "test_device_green"
            }, { headers: { Authorization: `Bearer ${token}` } });
            console.log('Green Zone Result:', greenRes.data.zone, greenRes.data.verified ? 'VERIFIED' : 'FAILED');
            if (greenRes.data.proof_token) console.log('Proof Token:', greenRes.data.proof_token);
        } catch (err) { console.error('Green Zone Failed:', err.response?.data || err.message); }

        // 3. Test Orange Zone (0.5km - 1.0km)
        // 0.006 deg lat is approx 0.66km
        console.log('\n--- Testing Orange Zone ---');
        try {
            await axios.post(`${API_URL}/kyc/location-verify`, {
                lat: 12.9716 + 0.006,
                lon: 77.5946,
                accuracy: 10,
                timestamp: new Date().toISOString(),
                device_id: "test_device_orange"
            }, { headers: { Authorization: `Bearer ${token}` } });
        } catch (err) {
            if (err.response && err.response.status === 400) {
                console.log('Orange Zone Result:', err.response.data.zone, err.response.data.message);
            } else {
                console.error('Orange Zone Unexpected Error:', err.message);
            }
        }

        // 4. Test Red Zone (> 1.0km)
        console.log('\n--- Testing Red Zone ---');
        try {
            await axios.post(`${API_URL}/kyc/location-verify`, {
                lat: 12.0000,
                lon: 77.0000,
                accuracy: 10,
                timestamp: new Date().toISOString(),
                device_id: "test_device_red"
            }, { headers: { Authorization: `Bearer ${token}` } });
        } catch (err) {
            if (err.response && err.response.status === 400) {
                console.log('Red Zone Result:', err.response.data.zone, err.response.data.message);
            } else {
                console.error('Red Zone Unexpected Error:', err.message);
            }
        }

        // 5. Test QR Verification
        console.log('\n--- Testing QR Verification ---');
        try {
            const qrRes = await axios.post(`${API_URL}/kyc/qr-verify`, {
                qr_code: "CAMPUS_SECURE_2025",
                device_id: "test_device_qr"
            }, { headers: { Authorization: `Bearer ${token}` } });
            console.log('QR Verification Result:', qrRes.data.verified ? 'VERIFIED' : 'FAILED', qrRes.data.method);
            if (qrRes.data.proof_token) console.log('Proof Token:', qrRes.data.proof_token);
        } catch (err) { console.error('QR Verification Failed:', err.response?.data || err.message); }

    } catch (error) {
        console.error('Test Suite Failed:', error.message);
    }
}

testAdvancedVerification();
