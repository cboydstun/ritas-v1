"use client";

import { useState, useEffect } from "react";
import AdminAuthCheck from "@/components/admin/AdminAuthCheck";
import AdminLayout from "@/components/admin/AdminLayout";

export default function QuickBooksPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Checking connection status...");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManualTokenForm, setShowManualTokenForm] = useState(false);
  const [tokenFormData, setTokenFormData] = useState({
    accessToken: "",
    refreshToken: "",
    expiresIn: "3600",
    refreshTokenExpiresIn: "8726400"
  });
  const [tokenSuccess, setTokenSuccess] = useState<string | null>(null);

  // Check connection status on page load
  useEffect(() => {
    checkConnectionStatus();
  }, []);

  // Function to check QuickBooks connection status
  const checkConnectionStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // This is a placeholder - in a real implementation, you would have an API endpoint
      // that checks if valid tokens are available
      const response = await fetch("/api/quickbooks/status");
      const data = await response.json();
      
      setIsConnected(data.connected);
      setConnectionStatus(data.connected ? "Connected to QuickBooks" : "Not connected to QuickBooks");
    } catch (err) {
      console.error("Error checking connection status:", err);
      setError("Failed to check connection status");
      setConnectionStatus("Unknown connection status");
    } finally {
      setLoading(false);
    }
  };

  // Function to initiate QuickBooks connection
  const connectToQuickBooks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch("/api/quickbooks/auth");
      const data = await response.json();
      
      if (data.authUrl) {
        // Redirect to QuickBooks authorization page
        window.location.href = data.authUrl;
      } else {
        setError("Failed to get authorization URL");
      }
    } catch (err) {
      console.error("Error connecting to QuickBooks:", err);
      setError("Failed to initiate QuickBooks connection");
    } finally {
      setLoading(false);
    }
  };

  // Function to disconnect from QuickBooks
  const disconnectFromQuickBooks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch("/api/quickbooks/disconnect", {
        method: "POST",
      });
      const data = await response.json();
      
      if (data.success) {
        setIsConnected(false);
        setConnectionStatus("Disconnected from QuickBooks");
      } else {
        setError("Failed to disconnect from QuickBooks");
      }
    } catch (err) {
      console.error("Error disconnecting from QuickBooks:", err);
      setError("Failed to disconnect from QuickBooks");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminAuthCheck>
      <AdminLayout>
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-6">QuickBooks Integration</h1>
          
          {/* Connection Status */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
            <p className={`text-lg ${isConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {connectionStatus}
            </p>
            
            {error && (
              <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-md">
                {error}
              </div>
            )}
            
            <div className="mt-6 flex gap-4">
              {!isConnected ? (
                <button
                  onClick={connectToQuickBooks}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50"
                >
                  {loading ? "Connecting..." : "Connect to QuickBooks"}
                </button>
              ) : (
                <button
                  onClick={disconnectFromQuickBooks}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50"
                >
                  {loading ? "Disconnecting..." : "Disconnect from QuickBooks"}
                </button>
              )}
              
              <button
                onClick={checkConnectionStatus}
                disabled={loading}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md disabled:opacity-50"
              >
                Refresh Status
              </button>
            </div>
          </div>
          
          {/* Token Helper */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">QuickBooks Token Helper</h2>
            <p className="mb-4">
              Use the tokens from your OAuth response to manually connect to QuickBooks.
            </p>
            
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md mb-4 overflow-x-auto">
              <pre className="text-xs">
                {`// From your .env.local file or OAuth response:
{
  "refreshToken": "RT1-27-H0-1753553094dl55jsp6ccpmtz719bzl",
  "accessToken": "eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2IiwieC5vcmciOiJIMCJ9..yEtklSpa_RvURNnSGN6YTQ.qrtkGXFTQCsxMahEujyXcEBoLP2QOob8Te98JYHX7Z68T2sN675iJJETT5r8IOsU85G6_8sKyhTabDkA4sy0mE7zsy94zQYufG5fo_L5Zn2w7rH3FfYqox9ZbmNMXbdUCdi3el1R6oSE-Ho0fRsEBmKYRBzhiZ5wb-wCi90s0syLEyGUavK36OquMs5-SesIg1ZXamyXx8LJWwHXWp24hx7W934lY9ZWDeYtV_52MI7tIZTnXbcZORlWg6FMF5-L7P_ivkh0qt5WFSuwputp2dSa46SO0x2L3ERWf7jobdX0_lkgBbvCP3WdOFsMkjVvveXP7iaKY06ZJBS7XGgBCxvB4Xtt2Fskv7rxwvkBwdXEiIln8gf9Jm-2kOfZdQ7jzDCx0OqV97HgXdY0RuVJsJ8l4SiepftvWWZ0Acj8sQO9FfYhTLwX8DPij2NZclKv4gpn65mdG0Nov0Arg9ArkZqDfbBJSgtZZEcwuMcJFvyVKBT1FZP6EcLbZKDYUn5DSv8EX6pCt1ahYZc7TalvXsz-Q3Qerux1TvjEHQSxjQBR75xPHXCfjTu9GNlTxKjp2S-SVc4_XOyCEAw-x-fH45wCpWv97RBWKrHrRWuBkHOUjPMtY_Ysd5-TIMyT5zzl.aDSk-kQ2ai-PWdcufkGyhQ",
  "expires_in": 3600,
  "x_refresh_token_expires_in": 8726400
}`}
              </pre>
            </div>
            
            <div className="flex gap-4 mb-4">
              <button
                onClick={() => {
                  setTokenFormData({
                    ...tokenFormData,
                    refreshToken: "RT1-27-H0-1753553094dl55jsp6ccpmtz719bzl"
                  });
                  setShowManualTokenForm(true);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
              >
                Use Sample Refresh Token
              </button>
              
              <button
                onClick={() => {
                  setTokenFormData({
                    ...tokenFormData,
                    accessToken: "eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2IiwieC5vcmciOiJIMCJ9..yEtklSpa_RvURNnSGN6YTQ.qrtkGXFTQCsxMahEujyXcEBoLP2QOob8Te98JYHX7Z68T2sN675iJJETT5r8IOsU85G6_8sKyhTabDkA4sy0mE7zsy94zQYufG5fo_L5Zn2w7rH3FfYqox9ZbmNMXbdUCdi3el1R6oSE-Ho0fRsEBmKYRBzhiZ5wb-wCi90s0syLEyGUavK36OquMs5-SesIg1ZXamyXx8LJWwHXWp24hx7W934lY9ZWDeYtV_52MI7tIZTnXbcZORlWg6FMF5-L7P_ivkh0qt5WFSuwputp2dSa46SO0x2L3ERWf7jobdX0_lkgBbvCP3WdOFsMkjVvveXP7iaKY06ZJBS7XGgBCxvB4Xtt2Fskv7rxwvkBwdXEiIln8gf9Jm-2kOfZdQ7jzDCx0OqV97HgXdY0RuVJsJ8l4SiepftvWWZ0Acj8sQO9FfYhTLwX8DPij2NZclKv4gpn65mdG0Nov0Arg9ArkZqDfbBJSgtZZEcwuMcJFvyVKBT1FZP6EcLbZKDYUn5DSv8EX6pCt1ahYZc7TalvXsz-Q3Qerux1TvjEHQSxjQBR75xPHXCfjTu9GNlTxKjp2S-SVc4_XOyCEAw-x-fH45wCpWv97RBWKrHrRWuBkHOUjPMtY_Ysd5-TIMyT5zzl.aDSk-kQ2ai-PWdcufkGyhQ"
                  });
                  setShowManualTokenForm(true);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
              >
                Use Sample Access Token
              </button>
            </div>
          </div>
          
          {/* Manual Token Form */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Manual Token Setup</h2>
            <p className="mb-4">
              If the automatic OAuth flow isn't working, you can manually set the tokens here.
            </p>
            
            <button
              onClick={() => setShowManualTokenForm(!showManualTokenForm)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md mb-4"
            >
              {showManualTokenForm ? "Hide Token Form" : "Show Token Form"}
            </button>
            
            {showManualTokenForm && (
              <div className="mt-4">
                {tokenSuccess && (
                  <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 rounded-md">
                    {tokenSuccess}
                  </div>
                )}
                
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  setLoading(true);
                  setError(null);
                  setTokenSuccess(null);
                  
                  try {
                    const response = await fetch("/api/quickbooks/set-tokens", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        accessToken: tokenFormData.accessToken,
                        refreshToken: tokenFormData.refreshToken,
                        expiresIn: parseInt(tokenFormData.expiresIn),
                        refreshTokenExpiresIn: parseInt(tokenFormData.refreshTokenExpiresIn),
                      }),
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                      setTokenSuccess("Tokens set successfully!");
                      // Clear form
                      setTokenFormData({
                        accessToken: "",
                        refreshToken: "",
                        expiresIn: "3600",
                        refreshTokenExpiresIn: "8726400"
                      });
                      // Check connection status
                      await checkConnectionStatus();
                    } else {
                      setError(data.message || "Failed to set tokens");
                    }
                  } catch (err) {
                    console.error("Error setting tokens:", err);
                    setError("Failed to set tokens");
                  } finally {
                    setLoading(false);
                  }
                }}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">
                      Access Token
                      <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={tokenFormData.accessToken}
                      onChange={(e) => setTokenFormData({...tokenFormData, accessToken: e.target.value})}
                      className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                      rows={3}
                      required
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">
                      Refresh Token
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={tokenFormData.refreshToken}
                      onChange={(e) => setTokenFormData({...tokenFormData, refreshToken: e.target.value})}
                      className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Expires In (seconds)
                      </label>
                      <input
                        type="number"
                        value={tokenFormData.expiresIn}
                        onChange={(e) => setTokenFormData({...tokenFormData, expiresIn: e.target.value})}
                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Refresh Token Expires In (seconds)
                      </label>
                      <input
                        type="number"
                        value={tokenFormData.refreshTokenExpiresIn}
                        onChange={(e) => setTokenFormData({...tokenFormData, refreshTokenExpiresIn: e.target.value})}
                        className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                      />
                    </div>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50"
                  >
                    {loading ? "Setting Tokens..." : "Set Tokens"}
                  </button>
                </form>
              </div>
            )}
          </div>
          
          {/* Configuration Instructions */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Configuration Instructions</h2>
            <div className="prose dark:prose-invert max-w-none">
              <p>
                To use the QuickBooks integration, you need to set up the following environment variables:
              </p>
              <ul className="list-disc pl-6 mt-2">
                <li><code>QB_CLIENT_ID</code> - Your QuickBooks application client ID</li>
                <li><code>QB_CLIENT_SECRET</code> - Your QuickBooks application client secret</li>
                <li><code>QB_REDIRECT_URI</code> - The redirect URI (should be <code>http://localhost:3000/api/quickbooks/callback</code> for local development)</li>
                <li><code>QB_ENVIRONMENT</code> - Either <code>sandbox</code> or <code>production</code></li>
                <li><code>QB_REALM_ID</code> - Your QuickBooks company ID (obtained after first authentication)</li>
              </ul>
              <p className="mt-4">
                After connecting to QuickBooks, invoices will be automatically generated when orders are completed through PayPal.
              </p>
            </div>
          </div>
        </div>
      </AdminLayout>
    </AdminAuthCheck>
  );
}
