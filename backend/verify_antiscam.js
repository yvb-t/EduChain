const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:5000/api';

async function testAntiScam() {
    try {
        const timestamp = Date.now();
        const email1 = `scam_test_1_${timestamp}@example.com`;
        const email2 = `scam_test_2_${timestamp}@example.com`;
        const phone = `99999${timestamp.toString().substring(8)}`; // Unique phone

        // 1. Register User 1
        console.log('--- 1. Registering User 1 ---');
        const res1 = await axios.post(`${API_URL}/auth/register`, {
            email: email1,
            password: 'password123',
            role: 'STUDENT',
            firstName: 'User',
            lastName: 'One',
            phone_number: phone
        });
        const token1 = res1.data.token;
        console.log('User 1 Registered. Token:', token1 ? 'OK' : 'MISSING');

        // 2. Test Duplicate Phone Registration
        console.log('\n--- 2. Testing Duplicate Phone Registration ---');
        try {
            await axios.post(`${API_URL}/auth/register`, {
                email: email2,
                password: 'password123',
                role: 'STUDENT',
                firstName: 'User',
                lastName: 'Two',
                phone_number: phone // Same phone
            });
            console.error('FAILED: Duplicate phone should have been rejected.');
        } catch (err) {
            if (err.response && err.response.status === 400) {
                console.log('SUCCESS: Duplicate phone rejected:', err.response.data.message);
            } else {
                console.error('ERROR: Unexpected error:', err.message);
            }
        }

        // 3. Test Document Fraud (Tampered Metadata)
        console.log('\n--- 3. Testing Document Fraud (Tampered Name) ---');
        // Create a dummy file
        const filePath = path.join(__dirname, 'edited_fake_doc.pdf');
        fs.writeFileSync(filePath, 'dummy content');

        const formData = new FormData();
        formData.append('document', fs.createReadStream(filePath));
        formData.append('docType', 'GOVT_ID');

        try {
            await axios.post(`${API_URL}/kyc/upload`, formData, {
                headers: {
                    Authorization: `Bearer ${token1}`,
                    ...formData.getHeaders()
                }
            });
            console.error('FAILED: Tampered document should have been rejected.');
        } catch (err) {
            if (err.response && err.response.status === 400) {
                console.log('SUCCESS: Tampered document rejected:', err.response.data.message);
            } else {
                console.error('ERROR: Unexpected error:', err.message);
            }
        }

        // Cleanup file
        fs.unlinkSync(filePath);

        // 4. Test Guardian Verification
        console.log('\n--- 4. Testing Guardian Verification ---');
        try {
            const guardRes = await axios.post(`${API_URL}/kyc/verify-guardian`, {
                guardian_phone: '9876543210',
                otp: '123456'
            }, { headers: { Authorization: `Bearer ${token1}` } });
            console.log('SUCCESS: Guardian Verified:', guardRes.data.message);
        } catch (err) {
            console.error('FAILED: Guardian verification error:', err.response?.data || err.message);
        }

    } catch (error) {
        console.error('Test Suite Failed:', error.message);
    }
}

testAntiScam();
