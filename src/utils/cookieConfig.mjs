// src/utils/cookieConfig.mjs
const cookieDomain = process.env.NODE_ENV === 'production' ? '.squadw.online' : 'localhost';
const siteConfig = process.env.NODE_ENV === 'production' ? { secure: true, sameSite: 'none' } : { secure: false, sameSite: 'lax' };
const cookieConfig = {
  base: {
    httpOnly: true,
    secure: siteConfig.secure,
    sameSite: siteConfig.sameSite,
    domain: cookieDomain,
    path: '/'
  },
  access: {
    maxAge: 3600000 // 1 hour
  },
  refresh: {
    maxAge: 604800000 // 7 days
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
