import { useEffect, useState } from 'react';

function App() {
  const [tokens, setTokens] = useState(null);
  const [email, setEmail] = useState('');
  const [files, setFiles] = useState([]);

  const CLIENT_ID = '97567018283-qhsa8t5j1s1ae563p0ae632dmrruqgeh.apps.googleusercontent.com';
  const REDIRECT_URI = 'https://salvoit74.github.io/drive-email-duplicate-cleaner';
  const SCOPES = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email';

  // Step 1: Trigger manual login
  const startGoogleLogin = () => {
    const state = crypto.randomUUID();
    localStorage.setItem('oauth_state', state);

    const url = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(SCOPES)}&access_type=offline&prompt=consent&state=${state}`;

    window.location.assign(url);
  };

  // Step 2: On page load, if there's a code in the URL, exchange it
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const storedState = localStorage.getItem('oauth_state');

    if (code && state === storedState) {
      exchangeCode(code);

      // Clean up URL
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);

  // Step 3: Call your PHP server to exchange code for token
  const exchangeCode = async (code) => {
    try {
      console.log('Call for token from code');
      const res = await fetch('https://grilletta.it/hugestore-code.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();
      console.log('🔐 Token exchange result:', data);

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

  const fetchFiles = async () => {
    const res = await fetch(
      'https://www.googleapis.com/drive/v3/files?pageSize=500&fields=files(id,name,size,md5Checksum,parents)',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const result = await res.json();
    // Filter files with a checksum and valid size, then sort by size descending
    const filteredSorted = (result.files || [])
      .filter(file => file.md5Checksum && file.size) // only files with checksum and size
      .sort((a, b) => Number(b.size) - Number(a.size)); // sort descending
    
    setFiles(filteredSorted);

  };

  return (
    <>
      <div style={{ padding: 20 }}>
        {!tokens?.access_token ? (
          <button onClick={startGoogleLogin}>🔐 Login with Google</button>
        ) : (
          <>
            <p>✅ Logged in as: {email}</p>
            <button onClick={() => { setTokens(null); setEmail(''); setFiles([]); }}>
              Logout
            </button>
            <button onClick={fetchFiles} style={{ marginLeft: 10 }}>
              📁 Fetch Drive Files
            </button>
            <table style={{ marginTop: 20, borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ borderBottom: '1px solid #ccc', padding: '8px', textAlign: 'left' }}>File Name</th>
                  <th style={{ borderBottom: '1px solid #ccc', padding: '8px', textAlign: 'left' }}>Size (MB)</th>
                  <th style={{ borderBottom: '1px solid #ccc', padding: '8px', textAlign: 'left' }}>MD5 Checksum</th>
                  <th style={{ borderBottom: '1px solid #ccc', padding: '8px', textAlign: 'left' }}>Folder</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id}>
                    <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{file.name}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>
                      {(file.size / (1024 * 1024)).toFixed(2)}
                    </td>
                    <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{file.md5Checksum}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>
                      {file.parents?.length ? (
                        <a href={`https://drive.google.com/drive/folders/${file.parents[0]}`} target="_blank" rel="noopener noreferrer">
                          Open Folder
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div id='after'>
        <table>
          <thead>
            <tr><th>Header</th></tr>
          </thead>
          <tbody>
            <tr><td><p>drive and email no more grown<br /></p></td></tr>
          </tbody>
          <tfoot></tfoot>
        </table>
      </div>
    </>
  );
}

export default App;
