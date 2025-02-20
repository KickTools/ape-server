// src/constants/streamer.mjs
const STREAMER_USERNAME = process.env.STREAMER_USERNAME || 'trainwreckstv';
const STREAMER_CHANNEL_ID = parseInt(process.env.STREAMER_CHANNEL_ID) || 715;
const STREAMER_USER_ID = parseInt(process.env.STREAMER_USER_ID) || 723;
const STREAMER_CHATROOM_ID = parseInt(process.env.STREAMER_CHATROOM_ID) || 715;

export const STREAMER = {
    username: STREAMER_USERNAME,
    channel_id: STREAMER_CHANNEL_ID,
    user_id: STREAMER_USER_ID,
    chatroom_id: STREAMER_CHATROOM_ID
};