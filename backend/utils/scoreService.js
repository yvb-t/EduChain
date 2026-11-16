const calculateTrustScore = (profile, kycStatus) => {
    let score = 0;

    // 1. KYC Verification (30 pts)
    if (kycStatus === 'VERIFIED') score += 30;

    // 2. Profile Completeness (20 pts)
    if (profile.full_name && profile.phone_number && profile.address) score += 10;
    if (profile.bio && profile.bio.length > 50) score += 10;

    // 3. Academic Records (20 pts)
    if (profile.institution_name && profile.course_name) score += 10;
    if (profile.academic_score && profile.academic_score > 0) score += 10;

    // 4. Social Links (10 pts)
    if (profile.social_links && profile.social_links.length > 5) score += 10;

    // 5. Video Pitch (20 pts)
    if (profile.video_pitch_url) score += 20;

    return Math.min(score, 100);
};

const calculateFinancialStressScore = (profile) => {
    let score = 0;
    const income = profile.family_annual_income || 0;

    // 1. Income Bracket (Max 50 pts)
    if (income < 100000) score += 50;
    else if (income < 300000) score += 30;
    else if (income < 500000) score += 10;

    // 2. Family Situation (Max 30 pts)
    // Assuming we might have fields like 'single_parent' or 'dependents' in future, 
    // for now we use bio keywords or just placeholder logic.
    // Let's use parent_occupation as a proxy if it indicates low income (mock logic)
    if (profile.parent_occupation && (profile.parent_occupation.toLowerCase().includes('farmer') || profile.parent_occupation.toLowerCase().includes('labour'))) {
        score += 20;
    }

    // 3. Location (Max 20 pts)
    // Mock: if address contains "Village" or "Rural"
    if (profile.permanent_address && (profile.permanent_address.toLowerCase().includes('village') || profile.permanent_address.toLowerCase().includes('rural'))) {
        score += 20;
    }

    return Math.min(score, 100);
};

module.exports = { calculateTrustScore, calculateFinancialStressScore };
