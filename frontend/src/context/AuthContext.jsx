import { createContext, useContext, useEffect, useState } from "react";

import {
  getCurrentUser,
  signupUser,
  loginUser,
  logoutUser,
  updateProfile as updateProfileRequest,
} from "../services/authService";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        const data = await getCurrentUser();

        setUser(data.user);
      } catch (error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuthentication();
  }, []);

  // Signup
  const signup = async (userData) => {
    const data = await signupUser(userData);

    setUser(data.user);

    return data;
  };

  // Login
  const login = async (credentials) => {
    const data = await loginUser(credentials);

    setUser(data.user);

    return data;
  };

  // Logout
  const logout = async () => {
    await logoutUser();

    setUser(null);
  };

  // Update profile
  const updateProfile = async (profileData) => {
    const data = await updateProfileRequest(profileData);

    setUser(data.user);

    return data;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,

        signup,
        login,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};