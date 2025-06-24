import { useEffect, useState } from 'react';

function App() {
  const [tokens, setTokens] = useState(null);
  const [email, setEmail] = useState('');
  const [files, setFiles] = useState([]);
  const [emails, setEmails] = useState([]);
  const [allEmails, setAllEmails] = useState([]);
  const [senderStats, setSenderStats] = useState([]);
  const [view, setView] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const CLIENT_ID = '97567018283-qhsa8t5j1s1ae563p0ae632dmrruqgeh.apps.googleusercontent.com';
  const REDIRECT_URI = 'https://salvoit74.github.io/drive-email-duplicate-cleaner';
  const SCOPES = 'https://www.googleapis.com/auth/photoslibrary.readonly https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gmail.readonly';

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
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.access_token) {
        setTokens(data);
        const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        const userInfo = await userRes.json();
        setEmail(userInfo.email);
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

  const loadAllEmails = async () => {
    setLoading(true);
    setProgress(0);
    let all = [];
    let pageToken = '';
    try {
      do {
        const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100&pageToken=${pageToken}`, {
          headers: { Authorization: `Bearer ${tokens.access_token}` }
        });
        const json = await res.json();
        if (json.messages) all = all.concat(json.messages);
        pageToken = json.nextPageToken || '';
        // Optionally update progress by pages fetched (can't know total pages easily though)
      } while (pageToken);
  
      // Fetch detailed metadata with progress update
      const detailed = [];
      for (let i = 0; i < all.length; i++) {
        const msg = all[i];
        const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata`, {
          headers: { Authorization: `Bearer ${tokens.access_token}` }
        });
        detailed.push(await msgRes.json());
        setProgress(((i + 1) / all.length) * 100);  // update progress in %
      }
  
      const mapped = detailed.map(m => ({
        id: m.id,
        sizeEstimate: m.sizeEstimate,
        from: m.payload?.headers?.find(h => h.name === 'From')?.value ?? 'unknown',
        subject: m.payload?.headers?.find(h => h.name === 'Subject')?.value ?? '(no subject)'
      }));
  
      setAllEmails(mapped);
      setView('email');
    } catch (e) {
      console.error('Error loading emails:', e);
    } finally {
      setLoading(false);
    }
  };

  const showEmailBySize = () => {
    setEmails([...allEmails].sort((a, b) => b.sizeEstimate - a.sizeEstimate));
    setView('email');
  };

  const showEmailBySender = () => {
    const senderCount = {};
    allEmails.forEach(m => {
      senderCount[m.from] = (senderCount[m.from] || 0) + 1;
    });
    const list = Object.entries(senderCount).map(([sender, count]) => ({ sender, count }))
      .sort((a, b) => b.count - a.count);
    setSenderStats(list);
    setView('senders');
  };

  const fetchPhotos = async () => {
    const res = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=100', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const { mediaItems } = await res.json();
    if (!mediaItems) return;
    const mapped = mediaItems.map(item => ({
      id: item.id,
      name: item.filename,
      size: item.mediaMetadata?.fileSize || 0,
      albumId: item.productUrl?.match(/\/album\/([\w-]+)/)?.[1],
      checksum: item.filename
    }));
    const sorted = mapped.sort((a, b) => b.size - a.size);
    setFiles(sorted);
    setView('photos');
  };

  const findDuplicatesPhoto = () => {
    const map = {};
    const dupes = [];
    for (const file of files) {
      if (!file.checksum) continue;
      if (map[file.checksum]) {
        if (!map[file.checksum].seen) {
          dupes.push(map[file.checksum].file);
          map[file.checksum].seen = true;
        }
        dupes.push(file);
      } else {
        map[file.checksum] = { file, seen: false };
      }
    }
    setFiles(dupes);
  };

  const thStyle = { borderBottom: '1px solid #ccc', padding: '8px', textAlign: 'left' };
  const tdStyle = { borderBottom: '1px solid #eee', padding: '8px' };

  return (
    <>
      {loading && (
        <div style={{ margin: '10px 0' }}>
          <p>Loading emails... {progress.toFixed(0)}%</p>
            <progress value={progress} max="100" style={{ width: '100%' }} />
        </div>
      )}
      <div style={{ padding: 20 }}>
        {!tokens?.access_token ? (
          <button onClick={startGoogleLogin}>🔐 Login with Google</button>
        ) : (
          <>
            <p>✅ Logged in as: {email}</p>
            <button onClick={() => { setTokens(null); setEmail(''); setFiles([]); setEmails([]); setSenderStats([]); setAllEmails([]); setView(''); }}>
              Logout
            </button>
            <button onClick={() => { fetchFiles(); setView('drive'); }}>
              📁 Fetch Drive Files (ordered by size)
            </button>
            <button onClick={() => { findDuplicates(); setView('duplicates'); }} style={{ marginLeft: 10 }}>
              🔍 Find Duplicates
            </button>
            <button onClick={() => { loadAllEmails(); }} style={{ marginLeft: 10 }}>
              📧 Load Gmail Emails
            </button>
            <button onClick={() => { showEmailBySize(); }} style={{ marginLeft: 10 }}>
              📧 Show Emails by Size
            </button>
            <button onClick={() => { showEmailBySender(); }} style={{ marginLeft: 10 }}>
              👤 Show Emails by Sender
            </button>
            <button onClick={fetchPhotos} style={{ marginLeft: 10 }}>
              🖼 Fetch Google Photos (ordered by size)
            </button>
            <button onClick={findDuplicatesPhoto} style={{ marginLeft: 10 }}>
              🔍 Find Duplicates Photos
            </button>

            {view === 'drive' && (
              <table style={{ marginTop: 20, borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Size (MB)</th>
                    <th>MD5 Checksum</th>
                    <th>Folder</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.id}>
                      <td>{file.name}</td>
                      <td>{(file.size / (1024 * 1024)).toFixed(2)}</td>
                      <td>{file.md5Checksum}</td>
                      <td>
                        {file.parents?.length ? (
                          <a href={`https://drive.google.com/drive/folders/${file.parents[0]}`} target="_blank" rel="noopener noreferrer">
                            Open Folder
                          </a>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {view === 'photos' && (
              <table style={{ marginTop: 20, borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>File Name</th>
                    <th style={thStyle}>Size (MB)</th>
                    <th style={thStyle}>Checksum</th>
                    <th style={thStyle}>Folder</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map(file => (
                    <tr key={file.id}>
                      <td style={tdStyle}>{file.name}</td>
                      <td style={tdStyle}>{(file.size / 1024 / 1024).toFixed(2)}</td>
                      <td style={tdStyle}>{file.checksum}</td>
                      <td style={tdStyle}>
                        {file.albumId ? (
                          <a href={`https://photos.google.com/album/${file.albumId}`} target="_blank" rel="noreferrer">
                            Open Album
                          </a>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {view === 'email' && (
              <table>
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
                        <a href={`https://mail.google.com/mail/u/0/#all/${email.id}`} target="_blank" rel="noopener noreferrer">
                          {email.subject}
                        </a>
                      </td>
                      <td>{(email.sizeEstimate / 1024 / 1024).toFixed(2)}</td>
                      <td>
                        <a href={`https://mail.google.com/mail/u/0/#search/from%3A${encodeURIComponent(email.from)}`} target="_blank" rel="noopener noreferrer">
                          {email.from}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {view === 'senders' && (
              <table>
                <thead>
                  <tr>
                    <th>Sender</th>
                    <th>Email Count</th>
                  </tr>
                </thead>
                <tbody>
                  {senderStats.map((item, index) => (
                    <tr key={index}>
                      <td>
                        <a href={`https://mail.google.com/mail/u/0/#search/from%3A${encodeURIComponent(item.sender)}`} target="_blank" rel="noopener noreferrer">
                          {item.sender}
                        </a>
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
    </>
  );
}



export default App;
