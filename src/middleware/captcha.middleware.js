import https from 'https';

/**
 * Middleware to verify Google reCAPTCHA v2 token
 */
export const verifyCaptcha = async (req, res, next) => {
    try {
        const { captchaToken } = req.body;

        if (!captchaToken) {
            const error = new Error('CAPTCHA verification required');
            error.statusCode = 400;
            throw error;
        }

        const secretKey = process.env.SECRET_KEY;
        if (!secretKey) {
            console.error('SECRET_KEY not configured in environment');
            const error = new Error('CAPTCHA verification not configured');
            error.statusCode = 500;
            throw error;
        }

        // Verify with Google reCAPTCHA API
        const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${captchaToken}`;
        
        const response = await new Promise((resolve, reject) => {
            https.get(verifyUrl, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });

        if (!response.success) {
            const error = new Error('CAPTCHA verification failed. Please try again.');
            error.statusCode = 400;
            throw error;
        }

        // CAPTCHA verified successfully, continue to next middleware
        next();
    } catch (error) {
        next(error);
    }
};
