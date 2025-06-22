import { useEffect, useState } from 'react';

function App() {
  const [tokens, setTokens] = useState(null);
  const [email, setEmail] = useState('');
  const [files, setFiles] = useState([]);
  const [emails, setEmails] = useState([]);
  const [senderStats, setSenderStats] = useState([]);
  const [view, setView] = useState('none');

  const CLIENT_ID = '97567018283-qhsa8t5j1s1ae563p0ae632dmrruqgeh.apps.googleusercontent.com';
  const REDIRECT_URI = 'https://salvoit74.github.io/drive-email-duplicate-cleaner';
  const SCOPES = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gmail.readonly';

  const thStyle = { borderBottom: '1px solid #ccc', padding: '8px', textAlign: 'left' };
  const tdStyle = { borderBottom: '1px solid #eee', padding: '8px' };

  const startGoogleLogin = () => {
    const state = crypto.randomUUID();
    localStorage.setItem('oauth_state', state);
    const url = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(SCOPES)}&access_type=offline&prompt=consent&state=${state}`;
    window.location.assign(url);
  };

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const storedState = localStorage.getItem('oauth_state');

    if (code && state === storedState) {
      exchangeCode(code);
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);

  const exchangeCode = async (code) => {
    try {
      const res = await fetch('https://grilletta.it/hugestore-code.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      if (data.access_token) {
        setTokens(data);
        const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${data.access_token}` }
        });
        const userInfo = await userRes.json();
        setEmail(userInfo.email);
      }
    } catch (err) {
      console.error('Token exchange failed', err);
    }
  };

  const fetchFiles = async () => {
    const res = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=500&fields=files(id,name,size,md5Checksum,parents)', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const result = await res.json();
    const filteredSorted = (result.files || [])
      .filter(file => file.md5Checksum && file.size)
      .sort((a, b) => Number(b.size) - Number(a.size));
    setFiles(filteredSorted);
  };

  const findDuplicates = () => {
    const checksumMap = {};
    const duplicates = [];
    for (const file of files) {
      if (!file.md5Checksum) continue;
      if (checksumMap[file.md5Checksum]) {
        if (!checksumMap[file.md5Checksum].seen) {
          duplicates.push(checksumMap[file.md5Checksum].file);
          checksumMap[file.md5Checksum].seen = true;
        }
        duplicates.push(file);
      } else {
        checksumMap[file.md5Checksum] = { file, seen: false };
      }
    }
    setFiles(duplicates);
  };

  const fetchEmailSizes = async () => {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const { messages } = await res.json();
    if (!messages) return;

    const detailed = await Promise.all(messages.map(async (msg) => {
      const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });
      return await msgRes.json();
    }));

    const sorted = detailed.map(m => ({
      id: m.id,
      sizeEstimate: m.sizeEstimate,
      from: m.payload?.headers?.find(h => h.name === 'From')?.value ?? 'unknown',
      subject: m.payload?.headers?.find(h => h.name === 'Subject')?.value ?? '(no subject)'
    })).sort((a, b) => a.sizeEstimate - b.sizeEstimate);

    setEmails(sorted);
  };

  const fetchSendersCount = async () => {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const { messages } = await res.json();
    if (!messages) return;

    const detailed = await Promise.all(messages.map(async (msg) => {
      const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });
      return await msgRes.json();
    }));

    const senderCount = {};
    detailed.forEach(m => {
      const from = m.payload?.headers?.find(h => h.name === 'From')?.value ?? 'unknown';
      senderCount[from] = (senderCount[from] || 0) + 1;
    });

    const list = Object.entries(senderCount)
      .map(([sender, count]) => ({ sender, count }))
      .sort((a, b) => a.count - b.count);

    setSenderStats(list);
  };

  return (
    <div style={{ padding: 20 }}>
      {!tokens?.access_token ? (
        <button onClick={startGoogleLogin}>🔐 Login with Google</button>
      ) : (
        <>
          <p>✅ Logged in as: {email}</p>
          <button onClick={() => { setTokens(null); setEmail(''); setFiles([]); }}>Logout</button>
          <button onClick={() => { fetchFiles(); setView('drive'); }}>📁 Fetch Drive Files (ordered by size)</button>
          <button onClick={() => { findDuplicates(); setView('duplicates'); }} style={{ marginLeft: 10 }}>🔍 Find Duplicates</button>
          <button onClick={() => { fetchEmailSizes(); setView('email'); }} style={{ marginLeft: 10 }}>📧 Fetch Gmail Emails (ordered by size)</button>
          <button onClick={() => { fetchSendersCount(); setView('senders'); }} style={{ marginLeft: 10 }}>👤 Count Emails by Sender</button>

          {view === 'drive' && (
            <table style={{ marginTop: 20, borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={thStyle}>File Name</th>
                  <th style={thStyle}>Size (MB)</th>
                  <th style={thStyle}>MD5 Checksum</th>
                  <th style={thStyle}>Folder</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id}>
                    <td style={tdStyle}>{file.name}</td>
                    <td style={tdStyle}>{(file.size / (1024 * 1024)).toFixed(2)}</td>
                    <td style={tdStyle}>{file.md5Checksum}</td>
                    <td style={tdStyle}>
                      {file.parents?.length ? (
                        <a href={`https://drive.google.com/drive/folders/${file.parents[0]}`} target="_blank" rel="noopener noreferrer">Open Folder</a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {view === 'email' && (
            <table style={{ marginTop: 20 }}>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Size (MB)</th>
                  <th>Sender</th>
                </tr>
              </thead>
              <tbody>
                {emails.map((email) => (
                  <tr key={email.id}>
                    <td>
                      <a href={`https://mail.google.com/mail/u/0/#all/${email.id}`} target="_blank" rel="noopener noreferrer">{email.subject}</a>
                    </td>
                    <td>{(email.sizeEstimate / 1024 / 1024).toFixed(2)}</td>
                    <td>
                      <a href={`https://mail.google.com/mail/u/0/#search/from%3A${encodeURIComponent(email.from)}`} target="_blank" rel="noopener noreferrer">{email.from}</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {view === 'senders' && (
            <table style={{ marginTop: 20 }}>
              <thead>
                <tr>
                  <th>Sender</th>
                  <th>Email Count</th>
                </tr>
              </thead>
              <tbody>
                {senderStats.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <a href={`https://mail.google.com/mail/u/0/#search/from%3A${encodeURIComponent(item.sender)}`} target="_blank" rel="noopener noreferrer">{item.sender}</a>
                    </td>
                    <td>{item.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

export default App;
