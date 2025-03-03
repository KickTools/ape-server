// src/utils/cookieConfig.mjs
const SEVEN_DAYS_IN_MS = 604800000; // 7 days

const cookieDomain = process.env.NODE_ENV === 'production' ? '.squadw.online' : 'localhost';
const siteConfig = process.env.NODE_ENV === 'production' ? { secure: true, sameSite: 'none' } : { secure: false, sameSite: 'strict' };
const cookieConfig = {
  base: {
    httpOnly: true,
    secure: siteConfig.secure,
    sameSite: siteConfig.sameSite,
    domain: cookieDomain,
    path: '/'
  },
  access: {
    maxAge: SEVEN_DAYS_IN_MS // 7 days
  },
  refresh: {
    maxAge: SEVEN_DAYS_IN_MS // 7 days
  }
};

export const getAccessTokenCookieConfig = () => ({
  ...cookieConfig.base,
  ...cookieConfig.access
});

export const getRefreshTokenCookieConfig = () => ({
  ...cookieConfig.base,
  ...cookieConfig.refresh
});
