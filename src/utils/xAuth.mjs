// src/utils/xAuth.mjs
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export class XAuth {
  constructor() {
    this.clientId = process.env.X_CLIENT_ID;
    this.clientSecret = process.env.X_CLIENT_SECRET;
    this.redirectUri = process.env.X_REDIRECT_URI;
    this.scopes = ['users.read', 'offline.access', 'tweet.read'];
  }

  getAuthorizationUrl(state) {
    const codeVerifier = uuidv4();
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    const url = `https://x.com/i/oauth2/authorize?response_type=code&client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=${encodeURIComponent(this.scopes.join(' '))}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
    
    return { url, codeVerifier };
  }

  async getToken(code, codeVerifier) {
    try {

      const response = await axios.post(
        'https://api.twitter.com/2/oauth2/token',
        new URLSearchParams({
          code,
          grant_type: 'authorization_code',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          code_verifier: codeVerifier
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error(`Error fetching token: ${error.response ? error.response.data : error.message}`);
      throw error; // re-throw the error to be caught in the calling function
    }
  }

  async refreshToken(refreshToken) {
    const response = await axios.post(
      'https://api.twitter.com/2/oauth2/token',
      new URLSearchParams({
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );
    return response.data;
  }

  async getUserData(accessToken) {
    try {
      const response = await axios.get('https://api.twitter.com/2/users/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          'user.fields': 'id,username,name,profile_image_url,created_at,description,public_metrics'
        }
      });
  
      return response.data.data;
    } catch (error) {
      console.error(`Error fetching user data: ${error.response ? error.response.data : error.message}`);
      if (error.response) {
        // If error response contains details, log the response
        console.error('Error Response:', error.response.data);
      }
      throw error; // re-throw the error for further handling
    }
  }
}
