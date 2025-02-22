// src/utils/kickApi.mjs
import axios from 'axios';

class KickAPIClient {
  constructor(config = {}) {
    this.baseURL = config.baseURL || 'https://api.kick.com';
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.accessToken = config.accessToken;

    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add authorization header when token is present
    this.axiosInstance.interceptors.request.use((config) => {
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });
  }

  setAccessToken(token) {
    this.accessToken = token;
  }

  // Error handler helper
  handleError(error) {
    const errorDetails = {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    };
    console.error('Kick API Error:', errorDetails);
    throw error;
  }

  // OAuth Methods
  async authorize(params) {
    try {
      const response = await this.axiosInstance.post('/oauth/authorize', null, {
        params: {
          response_type: params.responseType,
          client_id: params.clientId,
          redirect_uri: params.redirectUri,
          scope: params.scope,
          state: params.state,
          code_challenge: params.codeChallenge,
          code_challenge_method: params.codeChallengeMethod
        }
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getAccessToken(params) {
    try {
      const response = await this.axiosInstance.post('/oauth/token', null, {
        params: {
          grant_type: params.grantType,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code: params.code,
          redirect_uri: params.redirectUri,
          refresh_token: params.refreshToken
        }
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async revokeToken(token, tokenTypeHint) {
    try {
      const response = await this.axiosInstance.post('/oauth/revoke', null, {
        params: {
          token,
          token_type_hint: tokenTypeHint
        }
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async introspectToken() {
    try {
      const response = await this.axiosInstance.post('/public/v1/token/introspect');
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  // User Methods
  async getUsers(userIds = []) {
    try {
      const response = await this.axiosInstance.get('/public/v1/users', {
        params: {
          id: userIds
        }
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  // Channel Methods
  async getChannels(broadcasterUserIds = []) {
    try {
      const response = await this.axiosInstance.get('/public/v1/channels', {
        params: {
          broadcaster_user_id: broadcasterUserIds
        }
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async updateChannel(params) {
    try {
      const response = await this.axiosInstance.patch('/public/v1/channels', params);
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  // Category Methods
  async getCategories(query) {
    try {
      const response = await this.axiosInstance.get('/public/v1/categories', {
        params: { q: query }
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getCategory(categoryId) {
    try {
      const response = await this.axiosInstance.get(`/public/v1/categories/${categoryId}`);
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  // Chat Methods
  async sendChatMessage(params) {
    try {
      const response = await this.axiosInstance.post('/public/v1/chat', params);
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  // Event Subscription Methods
  async getEventSubscriptions() {
    try {
      const response = await this.axiosInstance.get('/public/v1/events/subscriptions');
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async createEventSubscriptions(params) {
    try {
      const response = await this.axiosInstance.post('/public/v1/events/subscriptions', params);
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async deleteEventSubscriptions(subscriptionIds) {
    try {
      const response = await this.axiosInstance.delete('/public/v1/events/subscriptions', {
        params: {
          id: subscriptionIds
        }
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  // Public Key Methods
  async getPublicKey() {
    try {
      const response = await this.axiosInstance.get('/public/v1/public-key');
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }
}

export default KickAPIClient;