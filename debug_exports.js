const scholarshipController = require('./backend/controllers/scholarshipController');
const updateController = require('./backend/controllers/updateController');
const authMiddleware = require('./backend/middleware/authMiddleware');
const uploadMiddleware = require('./backend/middleware/uploadMiddleware');

console.log('Scholarship Controller Exports:', Object.keys(scholarshipController));
console.log('Update Controller Exports:', Object.keys(updateController));
console.log('Auth Middleware Exports:', Object.keys(authMiddleware));
console.log('Upload Middleware Type:', typeof uploadMiddleware);

const requiredScholarship = ['createRequest', 'getAllRequests', 'getRequestById', 'deleteRequest', 'uploadProof', 'updateRequest', 'getDashboardStats', 'getUrgentCases'];
requiredScholarship.forEach(fn => {
    if (typeof scholarshipController[fn] !== 'function') {
        console.error(`MISSING or NOT A FUNCTION: scholarshipController.${fn}`);
    }
});

const requiredUpdate = ['createUpdate', 'getUpdates'];
requiredUpdate.forEach(fn => {
    if (typeof updateController[fn] !== 'function') {
        console.error(`MISSING or NOT A FUNCTION: updateController.${fn}`);
    }
});

if (typeof authMiddleware.protect !== 'function') {
    console.error('MISSING or NOT A FUNCTION: authMiddleware.protect');
}
