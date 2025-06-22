import { useState } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';

function App() {
  const [tokens, setTokens] = useState(null);
  const [email, setEmail] = useState('');
  const [files, setFiles] = useState([]);

  const login = useGoogleLogin({
    flow: 'auth-code',
    scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email',
    onSuccess: ({ code }) => {
      console.log('✅ Code received:', code);
      exchangeCode(code);
    },
    onError: (err) => console.error('❌ Login failed:', err),
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
    console.log('Call 3000');
	const res = await fetch('https://grilletta.it/hugestore-code.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    const data = await res.json();
    console.log('🔐 Token exchange result from local server:', data);

    if (data.access_token) {
      setTokens(data);

      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });

      const userInfo = await userRes.json();
      console.log('📧 User info:', userInfo);
      setEmail(userInfo.email);
    } else {
      console.error('❌ Token exchange failed:', data);
    }
  } catch (err) {
    console.error('❌ Exchange request failed:', err);
  }
};



return (
  <>
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

    <div id='after'>
      <table><thead>
			<tr><th>Header</th></tr>
		</thead><tbody>
        <tr><td><p>drive and email no more grown<br /></p></td></tr>
      </tbody><tfoot></tfoot></table>
    </div>
  </>
);
}

export default App;
