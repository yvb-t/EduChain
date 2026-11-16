const axios = require('axios');
const FormData = require('form-data');

const API_URL = 'http://localhost:5000/api';

async function testNoFile() {
    try {
        console.log("1️⃣ Logging in...");
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: "verified_student@educhain.com",
            password: "password123"
        });
        const token = loginRes.data.token;
        const studentId = loginRes.data.user.id;
        console.log("✅ Logged in.");

        // Cleanup: Delete existing active requests
        console.log("🧹 Cleaning up existing requests...");
        try {
            const existingRes = await axios.get(`${API_URL}/scholarships?studentId=${studentId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            for (const req of existingRes.data) {
                if (req.status === 'ACTIVE') {
                    console.log(`   Deleting request ${req.id}...`);
                    await axios.delete(`${API_URL}/scholarships/${req.id}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                }
            }
        } catch (err) {
            console.log("   No existing requests or cleanup failed (ignoring).");
        }

        console.log("2️⃣ Creating Request WITHOUT File...");
        const form = new FormData();
        form.append('title', 'No File Test');
        form.append('description', 'Testing request without file');
        form.append('amount', '1000');
        form.append('type', 'MICRO');
        form.append('category', 'Books');
        form.append('studentId', studentId);
        form.append('authority_number', 'AUTH-NO-FILE');
        form.append('institution_contact_number', '1234567890');

        form.append('personal_details', JSON.stringify({
            parentName: "Test Parent",
            currentAddress: "123 Test St"
        }));
        form.append('expenses', JSON.stringify([
            { id: 1, item: "Book", cost: "1000" }
        ]));

        // NO FILE APPENDED

        const config = {
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${token}`
            }
        };

        const res = await axios.post(`${API_URL}/scholarships`, form, config);
        console.log("✅ Request Created Successfully (No File)!");
        console.log("Response ID:", res.data.id);

    } catch (error) {
        console.error("❌ Request Failed!");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
        } else {
            console.error(error.message);
        }
    }
}

testNoFile();
