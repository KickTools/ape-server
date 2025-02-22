import axios from 'axios';
import crypto from 'crypto';
import querystring from 'querystring';

export const TwitchAuth = {
  TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID,
  TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET,
  TWITCH_REDIRECT_URI: process.env.TWITCH_REDIRECT_URI || 'http://localhost:9988/auth/twitch/callback',
  TWITCH_AUTH_BASE_URL: process.env.TWITCH_AUTH_BASE_URL || 'https://id.twitch.tv/oauth2',

  TWITCH_SCOPES: [
    'user:read:email'
  ].join(' '),

  generateState() {
    return crypto.randomBytes(32).toString('hex');
  },

  getAuthorizationUrl(state) {
    const twitchState = state || this.generateState();

    if (!this.TWITCH_CLIENT_ID) {
      throw new Error('TWITCH_CLIENT_ID environment variable is not set');
    }

    if (!this.TWITCH_REDIRECT_URI) {
      throw new Error('TWITCH_REDIRECT_URI environment variable is not set');
    }

    // Manually encode the scope
    const encodedScope = encodeURIComponent(this.TWITCH_SCOPES);

    const params = querystring.stringify({
      client_id: this.TWITCH_CLIENT_ID,
      redirect_uri: this.TWITCH_REDIRECT_URI,
      response_type: 'code',
      state: twitchState,
      force_verify: true
    });

    const authUrl = `${this.TWITCH_AUTH_BASE_URL}/authorize?${params}&scope=${encodedScope}`; // Add the scope manually

    return {
      url: authUrl,
      state: twitchState,
    };
  },

  async getTokens(code) {
    const tokenUrl = `${this.TWITCH_AUTH_BASE_URL}/token`;

    if (!code) {
      throw new Error('Authorization code is required');
    }

    const params = {
      client_id: this.TWITCH_CLIENT_ID,
      client_secret: this.TWITCH_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: this.TWITCH_REDIRECT_URI
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
  },

  async refreshTokenAccess(refreshToken) {
    const tokenUrl = `${this.TWITCH_AUTH_BASE_URL}/token`;

    const params = {
      client_id: this.TWITCH_CLIENT_ID,
      client_secret: this.TWITCH_CLIENT_SECRET,
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
  },

  async validateToken(accessToken) {
    const validateUrl = `${this.TWITCH_AUTH_BASE_URL}/validate`;

    try {
      const response = await axios.get(validateUrl, {
        headers: {
          'Authorization': `OAuth ${accessToken}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error validating token:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message
      });
      throw error;
    }
  },

  async revokeToken(token) {
    const revokeUrl = `${this.TWITCH_AUTH_BASE_URL}/revoke`;

    const params = {
      client_id: this.TWITCH_CLIENT_ID,
      token: token
    };

    try {
      await axios.post(revokeUrl, querystring.stringify(params), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      return true;
    } catch (error) {
      console.error('Error revoking token:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message
      });
      throw error;
    }
  }
};

export default TwitchAuth;