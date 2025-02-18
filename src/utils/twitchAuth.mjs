import axios from 'axios';
import querystring from 'querystring';

const TWITCH_CLIENT_ID = process.env.CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.CLIENT_SECRET;
const TWITCH_REDIRECT_URI = process.env.CALLBACK_URL;

// Function to get the authorization URL
export const getAuthorizationUrl = (state) => {
  const params = querystring.stringify({
    client_id: TWITCH_CLIENT_ID,
    redirect_uri: TWITCH_REDIRECT_URI,
    response_type: 'code',
    scope: 'user:read:email', // Adjust scope as needed
    state: state,
  });

  return `https://id.twitch.tv/oauth2/authorize?${params}`;
};

// Function to exchange authorization code for tokens
export const getTokens = async (code) => {
  const tokenUrl = 'https://id.twitch.tv/oauth2/token';

  // Add validation for code
  if (!code) {
    throw new Error('Authorization code is required');
  }

  const params = {
    client_id: TWITCH_CLIENT_ID,
    client_secret: TWITCH_CLIENT_SECRET,
    code: code,
    grant_type: 'authorization_code',
    redirect_uri: TWITCH_REDIRECT_URI,
  };

  try {

    const response = await axios.post(tokenUrl, querystring.stringify(params), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    return response.data;
  } catch (error) {
    // Improved error logging
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
  const tokenUrl = 'https://id.twitch.tv/oauth2/token';
  
  const params = {
    client_id: TWITCH_CLIENT_ID,
    client_secret: TWITCH_CLIENT_SECRET,
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