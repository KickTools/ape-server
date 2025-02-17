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
    console.error('Error fetching tokens:', error.response?.data || error.message);
    throw new Error('Failed to fetch tokens');
  }
};

// Function to refresh the access token
export const refreshTokenAccess = async (refreshToken) => {
  const tokenUrl = 'https://id.twitch.tv/oauth2/token';
  const params = {
    client_id: TWITCH_CLIENT_ID,
    client_secret: TWITCH_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  };

  try {
    const response = await axios.post(tokenUrl, querystring.stringify(params), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data;
  } catch (error) {
    console.error('Error refreshing access token:', error.response?.data || error.message);
    throw new Error('Failed to refresh access token');
  }
};