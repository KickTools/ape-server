import passport from "passport";
import { Strategy as TwitchStrategy } from "passport-twitch-new";

passport.serializeUser((user, done) => {
  // Save minimal user data in the session (e.g., user ID and tokens)
  done(null, { id: user.id, accessToken: user.accessToken, refreshToken: user.refreshToken });
});

passport.deserializeUser((sessionUser, done) => {
  // Retrieve user from session
  done(null, sessionUser);
});

passport.use(
  new TwitchStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: process.env.CALLBACK_URL,
      scope: "user:read:email"
    },
    function (accessToken, refreshToken, profile, done) {

      if (!accessToken) {
        return done(new Error("Failed to obtain access token"), null);
      }

      // Attach tokens to the profile object
      profile.accessToken = accessToken;
      profile.refreshToken = refreshToken;
      return done(null, profile);
    }
  )
);

export default passport;
