import { withIronSessionApiRoute } from 'iron-session/next';

export const sessionOptions = {
  cookieName: "twitch_auth_session",
  password: process.env.SESSION_SECRET,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    httpOnly: true
  },
};

export function withSession(handler) {
  return withIronSessionApiRoute(handler, sessionOptions);
}