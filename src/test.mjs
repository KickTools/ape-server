import express from 'express';
import dotenv from 'dotenv';
import { getAuthorizationUrl, getTokens, refreshTokenAccess, revokeToken } from './utils/kickAuth.mjs';

dotenv.config();

const app = express();
const port = 9988; // Matches your callback URL port

// Store PKCE and state values (In production, use a proper session store)
const stateStore = new Map();

app.get('/auth/kick', (req, res) => {
    // Get authorization URL and PKCE values
    const { url, state, code_verifier } = getAuthorizationUrl();
    console.log('Generated state:', state, url);
    
    // Store the values
    stateStore.set(state, {
        code_verifier,
        timestamp: Date.now()
    });
    
    // Clean up old states after 5 minutes
    setTimeout(() => stateStore.delete(state), 5 * 60 * 1000);
    
    // Redirect user to Kick authorization page
    res.redirect(url);
});

app.get('/auth/kick/callback', async (req, res) => {
    const { code, state } = req.query;
    
    // Verify state and get stored values
    const storedData = stateStore.get(state);
    if (!storedData) {
        return res.status(400).send('Invalid state parameter');
    }
    
    try {
        // Exchange code for tokens
        const tokens = await getTokens(code, storedData.code_verifier);
        console.log('Received tokens:', tokens);
        
        // Test refresh token
        console.log('\nTesting refresh token...');
        const refreshedTokens = await refreshTokenAccess(tokens.refresh_token);
        console.log('Refreshed tokens:', refreshedTokens);
        
        // Test token revocation
        console.log('\nTesting token revocation...');
        await revokeToken(refreshedTokens.access_token, 'access_token');
        console.log('Successfully revoked access token');
        
        res.send('OAuth flow completed successfully! Check your console for results.');
        
    } catch (error) {
        console.error('Error during OAuth flow:', error);
        res.status(500).send(`OAuth flow failed: ${error.message}`);
    } finally {
        // Clean up stored state
        stateStore.delete(state);
    }
});

// Start server
app.listen(port, () => {
    console.log(`\nTest server running at http://localhost:${port}`);
    console.log('\nTo test the OAuth flow:');
    console.log(`1. Visit http://localhost:${port}/auth/kick`);
    console.log('2. Log in to Kick and authorize the application');
    console.log('3. Watch the console for the OAuth flow results\n');
});