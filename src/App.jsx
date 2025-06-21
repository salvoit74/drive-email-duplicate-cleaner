import { useState } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';

function App() {
  const [tokens, setTokens] = useState(null);
  const [email, setEmail] = useState('');
  const [files, setFiles] = useState([]);

  const login = useGoogleLogin({
    flow: 'auth-code',
    scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email',
    onSuccess: async ({ code }) => {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: '97567018283-qhsa8t5j1s1ae563p0ae632dmrruqgeh.apps.googleusercontent.com',
          client_secret: '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',
          redirect_uri: 'https://salvoit74.github.io/drive-email-duplicate-cleaner/',
          grant_type: 'authorization_code',
        }),
      });

      const data = await tokenResponse.json();
      setTokens(data);

      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      const userInfo = await userRes.json();
      setEmail(userInfo.email);
    },
    onError: (err) => console.error('Login Failed', err),
  });

  const fetchFiles = async () => {
    const res = await fetch(
      'https://www.googleapis.com/drive/v3/files?pageSize=500&fields=files(id,name,size,md5Checksum)',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const result = await res.json();
    setFiles(result.files || []);
  };
  
  const exchangeCode = async (code) => {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: '97567018283-qhsa8t5j1s1ae563p0ae632dmrruqgeh.apps.googleusercontent.com',
        client_secret: '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',
        redirect_uri: 'https://salvoit74.github.io/drive-email-duplicate-cleaner/',
        grant_type: 'authorization_code',
      }),
    });

    const data = await res.json();
    console.log('🔐 Token exchange result:', data);
    setTokens(data);
  } catch (err) {
    console.error('❌ Token exchange error:', err);
  }
};


  return (
    <div style={{ padding: 20 }}>
      {!tokens?.access_token ? (
        <button onClick={() => login()}>🔐 Login with Google</button>
      ) : (
        <>
          <p>✅ Logged in as: {email}</p>
          <button onClick={() => { googleLogout(); setTokens(null); setEmail(''); setFiles([]); }}>
            Logout
          </button>
          <button onClick={fetchFiles} style={{ marginLeft: 10 }}>
            📁 Fetch Drive Files
          </button>

          <ul style={{ marginTop: 20 }}>
            {files.map((file) => (
              <li key={file.id}>
                {file.name} – {file.size ?? 'n/a'} bytes – {file.md5Checksum ?? 'no checksum'}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default App;
