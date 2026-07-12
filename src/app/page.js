// src/app/page.js
"use client";

import { useState, useEffect, useRef } from 'react';

const WATERMARK_LINKS = {
  github: "https://github.com/harshitkamboj",
  website: "https://harshitkamboj.in",
  discord: "https://discord.gg/DYJFE9nu5X"
};

export default function Home() {
  const [cookiesList, setCookiesList] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [tokenLink, setTokenLink] = useState('');
  const [expiryTime, setExpiryTime] = useState('');
  const [logs, setLogs] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Form states
  const [newCookieName, setNewCookieName] = useState('');
  const [newCookieRaw, setNewCookieRaw] = useState('');
  const [editCookieName, setEditCookieName] = useState('');
  const [editCookieRaw, setEditCookieRaw] = useState('');

  const consoleEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Initialize and load saved cookies from localStorage
  useEffect(() => {
    const initCookies = async () => {
      const saved = localStorage.getItem('netflix_cookies_profiles');
      let loadedList = [];
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            loadedList = parsed;
          }
        } catch (e) {
          console.error("Failed to parse cookies from localStorage", e);
        }
      }

      if (loadedList.length > 0) {
        setCookiesList(loadedList);
        setSelectedId(loadedList[0].id);
      } else {
        // Fetch copied cookies from backend
        try {
          addLog("No cookies found in browser storage. Preloading copied files from backend...", "info");
          const response = await fetch('/api/init-cookies');
          const data = await response.json();
          if (data.cookies && data.cookies.length > 0) {
            const importedList = data.cookies.map((cookie, index) => {
              const parsed = extractCookieDict(cookie.raw);
              return {
                id: (Date.now() + index).toString(),
                name: cookie.name,
                raw: cookie.raw,
                parsed
              };
            }).filter(item => item.parsed && item.parsed.NetflixId); // Only keep valid netflix cookies

            if (importedList.length > 0) {
              saveCookiesList(importedList);
              setCookiesList(importedList);
              setSelectedId(importedList[0].id);
              addLog(`Preloaded ${importedList.length} cookie profiles successfully.`, "success");
            } else {
              addLog("No valid cookies found in preloaded files.", "warning");
            }
          } else {
            addLog("No cookies available to preload from backend.", "info");
          }
        } catch (err) {
          console.error("Failed to preload cookies:", err);
          addLog(`Failed to preload cookies: ${err.message}`, "error");
        }
      }
    };

    initCookies();

    // Add initial log greeting
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs([
      { time, message: "Welcome to Netflix Cookie Manager.", type: "info" },
      { time, message: `Original script credits: ${WATERMARK_LINKS.github}`, type: "success" },
      { time, message: "Ready. Start managing cookies.", type: "info" }
    ]);
  }, []);

  // Save cookies to localStorage when the list changes
  const saveCookiesList = (newList) => {
    setCookiesList(newList);
    localStorage.setItem('netflix_cookies_profiles', JSON.stringify(newList));
  };

  // Scroll to bottom of log console whenever logs change
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Logging helper
  const addLog = (message, type = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs((prev) => [...prev, { time, message, type }]);
  };

  const clearLogs = () => {
    setLogs([]);
    addLog("System logs cleared.", "info");
  };

  // Decode utility for URL-encoded cookie values
  const decodeCookieValue = (value) => {
    if (typeof value === 'string' && value.includes('%')) {
      try {
        return decodeURIComponent(value);
      } catch (e) {
        return value;
      }
    }
    return value;
  };

  // Parse Netscape, Raw, and JSON cookie strings
  const extractCookieDict = (text) => {
    const cookieDict = {};
    const lines = text.split(/\r?\n/);

    // 1. Check for Netscape Cookie Format
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split('\t');
      if (parts.length >= 7) {
        cookieDict[parts[5]] = decodeCookieValue(parts[6]);
      }
    }

    // 2. Check for JSON Format
    try {
      const data = JSON.parse(text);
      const keys = ["NetflixId", "SecureNetflixId", "nfvdid", "OptanonConsent"];
      
      if (Array.isArray(data)) {
        for (const cookie of data) {
          const name = cookie.name || cookie.key;
          const value = cookie.value;
          if (keys.includes(name) && typeof value === 'string') {
            cookieDict[name] = decodeCookieValue(value);
          }
        }
      } else if (typeof data === 'object' && data !== null) {
        if (keys.some(key => key in data)) {
          for (const key of keys) {
            const value = data[key];
            if (typeof value === 'string') {
              cookieDict[key] = decodeCookieValue(value);
            }
          }
        } else if (Array.isArray(data.cookies)) {
          for (const cookie of data.cookies) {
            const name = cookie.name || cookie.key;
            const value = cookie.value;
            if (keys.includes(name) && typeof value === 'string') {
              cookieDict[name] = decodeCookieValue(value);
            }
          }
        }
      }
    } catch (e) {
      // Ignore JSON parsing errors
    }

    // 3. Fallback to Regex for Raw Cookie String
    const keys = ["NetflixId", "SecureNetflixId", "nfvdid", "OptanonConsent"];
    for (const key of keys) {
      if (cookieDict[key]) continue;
      const regex = new RegExp(`(?:^|;|,|\\s)${key}=([^;,\\s]+)`);
      const match = text.match(regex);
      if (match) {
        cookieDict[key] = decodeCookieValue(match[1]);
      }
    }

    return cookieDict;
  };

  // Helper to format timestamps
  const formatExpiry = (expires) => {
    if (!expires) return 'Unknown';
    try {
      const timestampMs = String(expires).length === 13 ? Number(expires) : Number(expires) * 1000;
      const date = new Date(timestampMs);
      if (isNaN(date.getTime())) return String(expires);
      
      const pad = (num) => String(num).padStart(2, '0');
      const yyyy = date.getFullYear();
      const mm = pad(date.getMonth() + 1);
      const dd = pad(date.getDate());
      const hh = pad(date.getHours());
      const min = pad(date.getMinutes());
      const ss = pad(date.getSeconds());
      return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
    } catch (e) {
      return String(expires);
    }
  };

  const handleAddCookie = () => {
    const name = newCookieName.trim();
    const raw = newCookieRaw.trim();

    if (!name) {
      alert("Please enter a profile name.");
      return;
    }
    if (!raw) {
      alert("Please paste the cookie content.");
      return;
    }

    const parsed = extractCookieDict(raw);
    if (!parsed || !parsed.NetflixId) {
      alert("Failed to parse cookies. The parsed data does not contain the required 'NetflixId' cookie value. Check your input format (JSON, Netscape, or Raw string).");
      return;
    }

    const newProfile = {
      id: Date.now().toString(),
      name,
      raw,
      parsed
    };

    const updated = [...cookiesList, newProfile];
    saveCookiesList(updated);
    setSelectedId(newProfile.id);
    
    addLog(`Created cookie profile: ${name} (parsed successfully)`, "success");

    // Clear form and close modal
    setNewCookieName('');
    setNewCookieRaw('');
    setIsAddModalOpen(false);
  };

  const handleEditCookie = () => {
    const name = editCookieName.trim();
    const raw = editCookieRaw.trim();

    if (!name) {
      alert("Please enter a profile name.");
      return;
    }
    if (!raw) {
      alert("Please paste the cookie content.");
      return;
    }

    const parsed = extractCookieDict(raw);
    if (!parsed || !parsed.NetflixId) {
      alert("Failed to parse cookies. The parsed data does not contain the required 'NetflixId' cookie value.");
      return;
    }

    const updated = cookiesList.map((item) => {
      if (item.id === selectedId) {
        return { ...item, name, raw, parsed };
      }
      return item;
    });

    saveCookiesList(updated);
    addLog(`Updated cookie profile: ${name}`, "success");
    setIsEditModalOpen(false);
  };

  const handleDeleteCookie = () => {
    const profile = cookiesList.find(c => c.id === selectedId);
    if (!profile) return;
    
    if (confirm(`Are you sure you want to delete profile "${profile.name}"?`)) {
      const updated = cookiesList.filter(c => c.id !== selectedId);
      saveCookiesList(updated);
      
      addLog(`Deleted profile: ${profile.name}`, "warning");
      
      if (updated.length > 0) {
        setSelectedId(updated[0].id);
      } else {
        setSelectedId('');
      }
    }
  };

  // Open Edit Modal with current profile values
  const openEditModal = () => {
    const current = cookiesList.find(c => c.id === selectedId);
    if (current) {
      setEditCookieName(current.name);
      setEditCookieRaw(current.raw);
      setIsEditModalOpen(true);
    }
  };

  // File Upload (Browsing) handler
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const parsed = extractCookieDict(text);
      
      if (!parsed || !parsed.NetflixId) {
        addLog(`Failed to import cookie from file "${file.name}": NetflixId not found.`, "error");
        alert(`Failed to import cookie from file "${file.name}". Ensure it contains a valid NetflixId cookie.`);
        return;
      }

      // Generate a default name from the file name without extension
      const defaultName = file.name.replace(/\.[^/.]+$/, "");
      
      const newProfile = {
        id: Date.now().toString(),
        name: defaultName,
        raw: text,
        parsed
      };

      const updated = [...cookiesList, newProfile];
      saveCookiesList(updated);
      setSelectedId(newProfile.id);
      
      addLog(`Successfully imported cookie from file "${file.name}" as profile: ${defaultName}`, "success");
    };

    reader.readAsText(file);
    // Reset file input value so same file can be uploaded again
    e.target.value = null;
  };

  const handleGenerate = async () => {
    const current = cookiesList.find(c => c.id === selectedId);
    if (!current) {
      addLog("Error: No cookie profile selected.", "error");
      return;
    }

    const netflixId = current.parsed.NetflixId;
    addLog(`Reading cookies from profile "${current.name}"...`);
    addLog(`Found cookies: ${Object.keys(current.parsed).join(', ')}`);
    addLog("Sending request to serverless API proxy...");
    
    setIsGenerating(true);
    setTokenLink('');
    setExpiryTime('');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ netflixId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server returned status ${response.status}`);
      }

      const { token, expires } = data;
      const loginUrl = `https://netflix.com/?nftoken=${token}`;
      
      setTokenLink(loginUrl);
      setExpiryTime(expires);

      addLog("Success! NFToken link generated successfully.", "success");
      addLog(`Expires: ${formatExpiry(expires)}`, "success");
    } catch (e) {
      addLog(`Failed: ${e.message}`, "error");
      alert(`Token generation failed:\n${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!tokenLink) return;
    navigator.clipboard.writeText(tokenLink).then(() => {
      setIsCopying(true);
      addLog("Copied login link to clipboard!", "success");
      setTimeout(() => setIsCopying(false), 2000);
    }).catch(err => {
      addLog(`Failed to copy link: ${err}`, "error");
    });
  };

  const currentProfile = cookiesList.find(c => c.id === selectedId);

  return (
    <div className="app-container">
      <header>
        <h1>Netflix Cookie Generator</h1>
        <p>A beautiful web version that generates Netflix login links from session cookies</p>
      </header>

      <main className="main-grid">
        {/* Left Column: Cookie Management */}
        <section className="card" id="cookie-manager-section">
          <h2 className="card-title">Cookie Profile Manager</h2>
          
          <div className="form-group">
            <label htmlFor="cookie-select">Select Cookie Profile:</label>
            <select
              id="cookie-select"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={cookiesList.length === 0}
            >
              {cookiesList.length > 0 ? (
                cookiesList.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))
              ) : (
                <option>No saved cookie profiles</option>
              )}
            </select>
          </div>

          <div className="input-row">
            <button 
              className="btn btn-primary" 
              onClick={() => setIsAddModalOpen(true)}
              title="Add New Cookie Manually"
            >
              + Add Cookie
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => fileInputRef.current?.click()}
              title="Browse text/JSON file"
            >
              Import File
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={openEditModal}
              disabled={!currentProfile}
              title="Edit Raw Contents of Selected Profile"
            >
              Edit File
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={handleDeleteCookie}
              disabled={!currentProfile}
              style={{ borderColor: '#552222', color: '#ff8888' }}
              title="Delete Selected Profile"
            >
              Delete
            </button>

            {/* Hidden File Input for Importing */}
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept=".txt,.json"
              onChange={handleFileUpload} 
            />
          </div>

          <button 
            className="btn btn-primary btn-large" 
            onClick={handleGenerate}
            disabled={!currentProfile || isGenerating}
            style={{ marginTop: '0.5rem' }}
          >
            {isGenerating ? "Generating..." : "Generate NFToken Link"}
          </button>
        </section>

        {/* Right Column: Output & Logs */}
        <section className="card" id="output-generator-section" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <h2 className="card-title">Output & Expiration</h2>
          
          <div className="expiry-display">
            <span className="expiry-label">Token Expiration:</span>
            <span className={`expiry-value ${expiryTime ? 'active' : ''}`}>
              {expiryTime ? formatExpiry(expiryTime) : "Not Generated Yet"}
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="token-output">Generated NFToken Login Link:</label>
            <div className="input-row">
              <input 
                id="token-output"
                type="text" 
                value={tokenLink} 
                readOnly 
                placeholder="https://netflix.com/?nftoken=..."
              />
              <button 
                className="btn btn-secondary" 
                onClick={handleCopy}
                disabled={!tokenLink}
                style={isCopying ? { backgroundColor: 'var(--success)', border: 'none', color: '#000000' } : {}}
              >
                {isCopying ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {/* Console System Log */}
          <div className="console-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>System Log & Status:</label>
              <button 
                className="btn btn-secondary" 
                onClick={clearLogs}
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px' }}
              >
                Clear
              </button>
            </div>
            
            <div className="console-area">
              {logs.map((log, idx) => (
                <div key={idx} className="log-entry">
                  <span className="log-time">[{log.time}]</span>
                  <span className={`log-${log.type}`}>{log.message}</span>
                </div>
              ))}
              <div ref={consoleEndRef} />
            </div>
          </div>
        </section>
      </main>

      {/* Add Cookie Profile Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Add New Cookie Profile</h3>
              <button className="modal-close" onClick={() => setIsAddModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="new-cookie-name">Profile Name:</label>
                <input 
                  id="new-cookie-name"
                  type="text" 
                  value={newCookieName} 
                  onChange={(e) => setNewCookieName(e.target.value)} 
                  placeholder="e.g., Netflix Account 1"
                />
              </div>
              <div className="form-group">
                <label htmlFor="new-cookie-raw">Paste Raw Cookie String, Netscape, or JSON Format:</label>
                <textarea 
                  id="new-cookie-raw"
                  rows={8}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                  value={newCookieRaw}
                  onChange={(e) => setNewCookieRaw(e.target.value)}
                  placeholder={`NetflixId=xxx; SecureNetflixId=xxx; nfvdid=xxx\n\nOR Netscape Cookie format\n\nOR JSON array format`}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddCookie}>Save & Parse</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Cookie Profile Modal */}
      {isEditModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Edit Cookie Profile</h3>
              <button className="modal-close" onClick={() => setIsEditModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="edit-cookie-name">Profile Name:</label>
                <input 
                  id="edit-cookie-name"
                  type="text" 
                  value={editCookieName} 
                  onChange={(e) => setEditCookieName(e.target.value)} 
                  placeholder="Profile Name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-cookie-raw">Raw Cookie Content:</label>
                <textarea 
                  id="edit-cookie-raw"
                  rows={8}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                  value={editCookieRaw}
                  onChange={(e) => setEditCookieRaw(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEditCookie}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      <footer>
        <p>
          Netflix Cookie Manager & NFToken Generator Web App &bull;&nbsp;
          <a href={WATERMARK_LINKS.github} target="_blank" rel="noopener noreferrer">Harshit Kamboj GitHub</a> &bull;&nbsp;
          <a href={WATERMARK_LINKS.website} target="_blank" rel="noopener noreferrer">Website</a> &bull;&nbsp;
          <a href={WATERMARK_LINKS.discord} target="_blank" rel="noopener noreferrer">Discord Server</a>
        </p>
      </footer>
    </div>
  );
}
