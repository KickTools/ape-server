import axios from 'axios';
import crypto from 'crypto';
import querystring from 'querystring';

const KICK_CLIENT_ID = "01JME9HC9V2KJQRG1FYHMF423H"
const KICK_CLIENT_SECRET = "27aa503952a9c5cd3a67921905f243aa1c7d4cd2a903d4e2904d3cd1d1568fd7"
const KICK_REDIRECT_URI = 'http://localhost:9988/auth/kick/callback'
const KICK_AUTH_BASE_URL = 'https://id.kick.com';

const KICK_SCOPES = [
    'user:read',
    'channel:read',
    'channel:write',
    'chat:write',
    'events:subscribe',
  ].join(' ');

// Generate a random string for state
const generateState = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Generate PKCE code verifier and challenge
const generatePKCE = () => {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
  
  return { verifier, challenge };
};

// Function to get the authorization URL
export const getAuthorizationUrl = () => {
    const state = generateState();
    const { verifier, challenge } = generatePKCE();
    
    if (!KICK_CLIENT_ID) {
      throw new Error('KICK_CLIENT_ID environment variable is not set');
    }
  
    if (!KICK_REDIRECT_URI) {
      throw new Error('KICK_CALLBACK_URL environment variable is not set');
    }
    
    console.log('Generated state:', state);
    console.log('Code verifier:', verifier);
    console.log('Code challenge:', challenge);
  
    const params = querystring.stringify({
      client_id: KICK_CLIENT_ID,
      redirect_uri: KICK_REDIRECT_URI,
      response_type: 'code',
      scope: KICK_SCOPES,
      state: state,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    });
  
    const authUrl = `${KICK_AUTH_BASE_URL}/oauth/authorize?${params}`;
    console.log('Authorization URL:', authUrl);
  
    return {
      url: authUrl,
      state,
      code_verifier: verifier
    };
  };

// Function to exchange authorization code for tokens
export const getTokens = async (code, codeVerifier) => {
  const tokenUrl = `${KICK_AUTH_BASE_URL}/oauth/token`;

  if (!code) {
    throw new Error('Authorization code is required');
  }

  if (!codeVerifier) {
    throw new Error('Code verifier is required');
  }

  const params = {
    client_id: KICK_CLIENT_ID,
    client_secret: KICK_CLIENT_SECRET,
    code: code,
    grant_type: 'authorization_code',
    redirect_uri: KICK_REDIRECT_URI,
    code_verifier: codeVerifier
  };

  try {
    const response = await axios.post(tokenUrl, querystring.stringify(params), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching tokens:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
};

// Function to refresh the access token
export const refreshTokenAccess = async (refreshToken) => {
  const tokenUrl = `${KICK_AUTH_BASE_URL}/oauth/token`;
  
  const params = {
    client_id: KICK_CLIENT_ID,
    client_secret: KICK_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  };

  try {
    const response = await axios.post(tokenUrl, querystring.stringify(params), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    return response.data;
  } catch (error) {
    console.error('Error refreshing tokens:', {
      status: error.response?.status,
      message: error.response?.data?.message || error.message
    });
    throw error;
  }
};

// Function to revoke a token
export const revokeToken = async (token, tokenType) => {
  const revokeUrl = `${KICK_AUTH_BASE_URL}/oauth/revoke`;
  
  const params = {
    token: token,
    ...(tokenType && { token_hint_type: tokenType }) // Only add if tokenType is provided
  };

  try {
    await axios.post(revokeUrl, null, { params });
    return true;
  } catch (error) {
    console.error('Error revoking token:', {
      status: error.response?.status,
      message: error.response?.data?.message || error.message
    });
    throw error;
  }
};