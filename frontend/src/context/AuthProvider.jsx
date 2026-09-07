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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /*
   * ==========================================
   * GET CURRENT USER
   * ==========================================
   */

  const loadUser = useCallback(async () => {
    try {
      const data = await getCurrentUser();

      setUser(data.user || null);
    } catch (error) {
      console.error("Load user error:", error);
      setUser(null);
    } finally {
      setLoading(false);
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