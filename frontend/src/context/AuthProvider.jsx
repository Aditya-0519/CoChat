import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AuthContext } from "./AuthContext";

import {
  getCurrentUser,
  signupUser,
  loginUser,
  loginWithGoogle as loginWithGoogleRequest,
  logoutUser,
  updateProfile as updateProfileRequest,
  uploadAvatar as uploadAvatarRequest,
} from "../services/authService";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /*
   * ==========================================
   * GET CURRENT USER
   * ==========================================
   *
   * The Render backend can cold-start (free tier spins down
   * after inactivity), which can make the very first request
   * fail or time out even though the session cookie is still
   * valid. Instead of immediately treating that as "logged
   * out", retry a couple of times with a short backoff before
   * giving up. A genuine 401 ("Not authenticated" / "Invalid or
   * expired session") still resolves to logged-out immediately.
   */

  const loadUser = useCallback(async () => {
    const MAX_ATTEMPTS = 3;
    const RETRY_DELAY_MS = 1500;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const data = await getCurrentUser();
        setUser(data.user || null);
        setLoading(false);
        return;
      } catch (error) {
        const isAuthFailure =
          error?.status === 401 ||
          /not authenticated|invalid or expired session/i.test(
            error?.message || ""
          );

        // A real "you are not logged in" response — stop immediately.
        if (isAuthFailure) {
          console.error("Load user error:", error);
          setUser(null);
          setLoading(false);
          return;
        }

        // Likely a transient/network/cold-start failure — retry.
        if (attempt < MAX_ATTEMPTS) {
          await sleep(RETRY_DELAY_MS * attempt);
          continue;
        }

        console.error("Load user error:", error);
        setUser(null);
        setLoading(false);
      }
    }
  }, []);

  /*
   * ==========================================
   * INITIAL AUTH CHECK
   * ==========================================
   */

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  /*
   * ==========================================
   * SIGNUP
   * ==========================================
   */

  const signup = useCallback(async (userData) => {
    const data = await signupUser(userData);

    setUser(data.user);

    return data;
  }, []);

  /*
   * ==========================================
   * LOGIN
   * ==========================================
   */

  const login = useCallback(async (credentials) => {
    const data = await loginUser(credentials);

    setUser(data.user);

    return data;
  }, []);

  const loginWithGoogle = useCallback(
  async (credential) => {
    const data =
      await loginWithGoogleRequest(
        credential
      );

    setUser(data.user);

    return data;
  },
  []
);

  /*
   * ==========================================
   * LOGOUT
   * ==========================================
   */

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } finally {
      setUser(null);
    }
  }, []);

  /*
   * ==========================================
   * UPDATE PROFILE
   * ==========================================
   */

  const updateProfile = useCallback(async (profileData) => {
    const data = await updateProfileRequest(profileData);

    setUser(data.user);

    return data;
  }, []);

  /*
   * ==========================================
   * UPLOAD AVATAR
   * ==========================================
   */

  const uploadAvatar = useCallback(async (file) => {
    const data = await uploadAvatarRequest(file);

    setUser(data.user);

    return data;
  }, []);

  /*
   * ==========================================
   * CONTEXT VALUE
   * ==========================================
   */

  const value = useMemo(
  () => ({
    user,
    loading,
    isAuthenticated: !!user,

    signup,
    login,
    loginWithGoogle,
    logout,
    updateProfile,
    uploadAvatar,

    refreshUser: loadUser,
    setUser,
  }),
    [
      user,
      loading,
      signup,
      login,
      loginWithGoogle,
      logout,
      updateProfile,
      uploadAvatar,
      loadUser,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;