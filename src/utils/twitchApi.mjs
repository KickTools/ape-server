import axios from 'axios';

class TwitchAPIClient {
  constructor(config = {}) {
    this.baseURL = config.baseURL || 'https://api.twitch.tv/helix';
    this.clientId = config.clientId;
    this.accessToken = config.accessToken;

    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': this.clientId,
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    // Add authorization header when token is present
    this.axiosInstance.interceptors.request.use((config) => {
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });

    // Add rate limit handling
    this.axiosInstance.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          return new Promise(resolve => {
            setTimeout(() => resolve(this.axiosInstance(error.config)), retryAfter * 1000);
          });
        }
        return Promise.reject(error);
      }
    );
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
    console.error('Twitch API Error:', errorDetails);
    throw error;
  }

  // User Methods
  async getCurrentUser() {

    try {
      const response = await this.axiosInstance.get('/users');
      return response.data.data[0];
    } catch (error) {
      this.handleError(error);
    }
  }

  async getUsers(params) {
    try {
      const response = await this.axiosInstance.get('/users', { params });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  // Channel Methods
  async getChannelInfo(broadcasterId) {
    try {
      const response = await this.axiosInstance.get('/channels', {
        params: { broadcaster_id: broadcasterId }
      });
      return response.data.data[0];
    } catch (error) {
      this.handleError(error);
    }
  }

  async modifyChannelInfo(broadcasterId, params) {
    try {
      const response = await this.axiosInstance.patch(`/channels?broadcaster_id=${broadcasterId}`, params);
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  // Stream Methods
  async getStreams(params) {
    try {
      const response = await this.axiosInstance.get('/streams', { params });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  // Follow Methods
  async getChannelFollowers(broadcasterId, params = {}) {
    try {
      const response = await this.axiosInstance.get('/channels/followers', {
        params: { broadcaster_id: broadcasterId, ...params }
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getFollowedChannels(userId, params = {}) {
    try {
      const response = await this.axiosInstance.get('/channels/followed', {
        params: { user_id: userId, ...params }
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  // Subscription Methods
  async getChannelSubscribers(broadcasterId, params = {}) {
    try {
      const response = await this.axiosInstance.get('/subscriptions', {
        params: { broadcaster_id: broadcasterId, ...params }
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  // Game/Category Methods
  async getGames(params) {
    try {
      const response = await this.axiosInstance.get('/games', { params });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getTopGames(params = {}) {
    try {
      const response = await this.axiosInstance.get('/games/top', { params });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  // Clip Methods
  async createClip(broadcasterId) {
    try {
      const response = await this.axiosInstance.post('/clips', null, {
        params: { broadcaster_id: broadcasterId }
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getClips(params) {
    try {
      const response = await this.axiosInstance.get('/clips', { params });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  // Chat Methods
  async getChatters(broadcasterId, moderatorId) {
    try {
      const response = await this.axiosInstance.get('/chat/chatters', {
        params: {
          broadcaster_id: broadcasterId,
          moderator_id: moderatorId
        }
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getChatSettings(broadcasterId) {
    try {
      const response = await this.axiosInstance.get('/chat/settings', {
        params: { broadcaster_id: broadcasterId }
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  async updateChatSettings(broadcasterId, moderatorId, settings) {
    try {
      const response = await this.axiosInstance.patch('/chat/settings', settings, {
        params: {
          broadcaster_id: broadcasterId,
          moderator_id: moderatorId
        }
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }

  // Analytics Methods
  async getGameAnalytics(params) {
    try {
      const response = await this.axiosInstance.get('/analytics/games', { params });
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
  }
}

export default TwitchAPIClient;