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
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [pendingAction, setPendingAction] = useState(null); // 'add' | 'edit' | 'import-single' | 'import-bulk' | 'export-bulk' | 'open-link'
  const [pendingActionData, setPendingActionData] = useState(null);

  // Form states
  const [newCookieName, setNewCookieName] = useState('');
  const [newCookieRaw, setNewCookieRaw] = useState('');
  const [editSelectedId, setEditSelectedId] = useState('');
  const [editCookieName, setEditCookieName] = useState('');
  const [editCookieRaw, setEditCookieRaw] = useState('');

  const [checkCookieRaw, setCheckCookieRaw] = useState('');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkProgress, setBulkProgress] = useState([]);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);

  const consoleEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const bulkFileInputRef = useRef(null);
  const isVerifyingRef = useRef(false);

  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert',
    onConfirm: null,
    onCancel: null
  });

  const showAlert = (message, title = 'Thông báo') => {
    return new Promise((resolve) => {
      setAlertModal({
        isOpen: true,
        title,
        message,
        type: 'alert',
        onConfirm: () => {
          setAlertModal(prev => ({ ...prev, isOpen: false }));
          resolve(true);
        },
        onCancel: null
      });
    });
  };

  const showConfirm = (message, title = 'Xác nhận') => {
    return new Promise((resolve) => {
      setAlertModal({
        isOpen: true,
        title,
        message,
        type: 'confirm',
        onConfirm: () => {
          setAlertModal(prev => ({ ...prev, isOpen: false }));
          resolve(true);
        },
        onCancel: () => {
          setAlertModal(prev => ({ ...prev, isOpen: false }));
          resolve(false);
        }
      });
    });
  };

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
        // Sort loaded profiles alphabetically/numerically
        const sorted = [...loadedList].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        setCookiesList(sorted);
        setSelectedId(sorted[0].id);
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
              const sorted = saveCookiesList(importedList);
              setSelectedId(sorted[0].id);
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
  }, []);

  // Save cookies to localStorage when the list changes (and sort them numerically/alphabetically by name)
  const saveCookiesList = (newList) => {
    const sorted = [...newList].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    setCookiesList(sorted);
    localStorage.setItem('netflix_cookies_profiles', JSON.stringify(sorted));
    
    // Sync to backend file system asynchronously
    fetch('/api/sync-cookies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cookies: sorted }),
    }).then(res => {
      if (!res.ok) {
        console.error("Failed to sync cookies to backend folder");
      }
    }).catch(err => {
      console.error("Error syncing cookies:", err);
    });

    return sorted;
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
    let isNetscape = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('#')) {
        isNetscape = true;
        continue;
      }
      const parts = trimmed.split('\t');
      if (parts.length >= 7) {
        cookieDict[parts[5]] = decodeCookieValue(parts[6]);
        isNetscape = true;
      }
    }

    if (isNetscape && Object.keys(cookieDict).length > 0) {
      return cookieDict;
    }

    // 2. Check for JSON Format
    try {
      const data = JSON.parse(text);
      
      const processCookie = (cookie) => {
        const name = cookie.name || cookie.key || cookie.Name || cookie.Key;
        const value = cookie.value || cookie.Value;
        if (name && typeof value === 'string') {
          cookieDict[name] = decodeCookieValue(value);
        }
      };

      if (Array.isArray(data)) {
        for (const cookie of data) {
          processCookie(cookie);
        }
      } else if (typeof data === 'object' && data !== null) {
        // Direct key-value JSON
        for (const [key, val] of Object.entries(data)) {
          if (typeof val === 'string' && key !== 'cookies') {
            cookieDict[key] = decodeCookieValue(val);
          }
        }
        // Nested cookies array
        if (Array.isArray(data.cookies)) {
          for (const cookie of data.cookies) {
            processCookie(cookie);
          }
        }
      }
      if (Object.keys(cookieDict).length > 0) {
        return cookieDict;
      }
    } catch (e) {
      // Ignore JSON parsing errors
    }

    // 3. Fallback to parsing semicolon-separated cookie headers
    const pairs = text.split(';');
    for (const pair of pairs) {
      const trimmedPair = pair.trim();
      if (!trimmedPair) continue;
      const parts = trimmedPair.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        if (key && !key.startsWith('#')) {
          cookieDict[key] = decodeCookieValue(value);
        }
      }
    }

    return cookieDict;
  };

  // Convert parsed cookies back into standard Netscape format
  const generateNetscapeCookieString = (cookieDict) => {
    let output = `# Netscape HTTP Cookie File\n# https://curl.haxx.se/rfc/cookie_spec.html\n# This is a generated file! Do not edit.\n\n`;
    
    const defaultExpiry = 1791646041; 
    
    for (const [name, value] of Object.entries(cookieDict)) {
      if (!name || !value) continue;
      
      const domain = name === 'OTSessionTracking' ? 'www.netflix.com' : '.netflix.com';
      const domainOnly = name === 'OTSessionTracking' ? 'FALSE' : 'TRUE';
      const path = '/';
      const isSecure = (name === 'NetflixId' || name === 'SecureNetflixId' || name === 'gsid' || name === 'dsca') ? 'TRUE' : 'FALSE';
      
      output += `${domain}\t${domainOnly}\t${path}\t${isSecure}\t${defaultExpiry}\t${name}\t${value}\n`;
    }
    return output.trim() + '\n';
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

  const handleAddCookie = async () => {
    const name = newCookieName.trim();
    const raw = newCookieRaw.trim();

    if (!name) {
      await showAlert("Vui lòng nhập tên cấu hình cookie.", "Thiếu thông tin");
      return;
    }
    if (!raw) {
      await showAlert("Vui lòng dán nội dung cookie vào ô nhập.", "Thiếu thông tin");
      return;
    }

    const parsed = extractCookieDict(raw);
    if (!parsed || !parsed.NetflixId) {
      await showAlert("Không thể phân tích cookie. Nội dung đã dán không chứa giá trị cookie 'NetflixId' bắt buộc. Vui lòng kiểm tra lại định dạng (JSON, Netscape, hoặc chuỗi Raw).", "Lỗi phân tích");
      return;
    }

    const formattedRaw = generateNetscapeCookieString(parsed);

    const newProfile = {
      id: Date.now().toString(),
      name,
      raw: formattedRaw,
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

  const handleEditCookie = async () => {
    const name = editCookieName.trim();
    const raw = editCookieRaw.trim();

    if (!name) {
      await showAlert("Vui lòng nhập tên cấu hình cookie.", "Thiếu thông tin");
      return;
    }
    if (!raw) {
      await showAlert("Vui lòng dán nội dung cookie vào ô nhập.", "Thiếu thông tin");
      return;
    }

    const parsed = extractCookieDict(raw);
    if (!parsed || !parsed.NetflixId) {
      await showAlert("Không thể phân tích cookie. Dữ liệu đã phân tích không chứa giá trị cookie 'NetflixId' bắt buộc.", "Lỗi phân tích");
      return;
    }

    const formattedRaw = generateNetscapeCookieString(parsed);

    const updated = cookiesList.map((item) => {
      if (item.id === editSelectedId) {
        return { ...item, name, raw: formattedRaw, parsed };
      }
      return item;
    });

    saveCookiesList(updated);
    setSelectedId(editSelectedId);
    addLog(`Updated cookie profile: ${name}`, "success");
    setIsEditModalOpen(false);
  };

  const handleSwitchEditProfile = (id) => {
    const target = cookiesList.find(c => c.id === id);
    if (target) {
      setEditSelectedId(target.id);
      setEditCookieName(target.name);
      setEditCookieRaw(target.raw);
    }
  };

  const handleDeleteCookie = async () => {
    const profile = cookiesList.find(c => c.id === selectedId);
    if (!profile) return;
    
    const confirmed = await showConfirm(`Bạn có chắc chắn muốn xóa cấu hình "${profile.name}" không?`, "Xác nhận xóa");
    if (confirmed) {
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

  const handleExportAll = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cookiesList, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `netflix_cookies_export_${new Date().toISOString().slice(0,10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      addLog("Đã xuất danh sách cookie thành công.", "success");
    } catch (err) {
      addLog(`Lỗi xuất file: ${err.message}`, "error");
      showAlert(`Lỗi xuất file: ${err.message}`, "Lỗi");
    }
  };

  const handleBulkImportUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsedData = JSON.parse(event.target.result);
        if (!Array.isArray(parsedData)) {
          throw new Error("Dữ liệu file không phải là danh sách (Array).");
        }

        let importCount = 0;
        let duplicateCount = 0;
        const updatedList = [...cookiesList];

        for (const item of parsedData) {
          if (!item.name || !item.raw || !item.parsed) continue;

          const itemNetflixId = item.parsed?.NetflixId;
          if (!itemNetflixId) continue;

          const isDuplicate = updatedList.some(c => c.parsed?.NetflixId === itemNetflixId);
          if (isDuplicate) {
            duplicateCount++;
            const index = updatedList.findIndex(c => c.parsed?.NetflixId === itemNetflixId);
            updatedList[index] = {
              ...item,
              id: updatedList[index].id
            };
          } else {
            updatedList.push({
              ...item,
              id: (Date.now() + importCount).toString()
            });
            importCount++;
          }
        }

        if (importCount > 0 || duplicateCount > 0) {
          const sorted = saveCookiesList(updatedList);
          if (sorted.length > 0) {
            setSelectedId(sorted[0].id);
          }
          addLog(`Nhập thành công ${importCount} cấu hình mới, cập nhật ${duplicateCount} cấu hình trùng lặp.`, "success");
          await showAlert(`Nhập thành công ${importCount} cấu hình mới, cập nhật ${duplicateCount} cấu hình trùng lặp.`, "Thành công");
        } else {
          await showAlert("Không tìm thấy cấu hình cookie Netflix hợp lệ nào để nhập.", "Thông báo");
        }

      } catch (err) {
        addLog(`Lỗi nhập file: ${err.message}`, "error");
        await showAlert(`Không thể đọc file. Lỗi: ${err.message}`, "Lỗi nhập file");
      }
    };

    reader.readAsText(file);
    e.target.value = null;
  };

  const requestPin = (actionType, actionData = null) => {
    setPendingAction(actionType);
    setPendingActionData(actionData);
    isVerifyingRef.current = false;
    setPin(['', '', '', '', '', '']);
    setIsPinModalOpen(true);
    setTimeout(() => {
      const firstInput = document.getElementById('pin-input-0');
      if (firstInput) firstInput.focus();
    }, 50);
  };

  const openEditModal = () => {
    const current = cookiesList.find(c => c.id === selectedId);
    if (current) {
      requestPin('edit');
    }
  };

  const verifyPin = async (pinArray) => {
    if (isVerifyingRef.current) return;

    const pinString = pinArray.join('');
    if (pinString.length < 6) return;

    isVerifyingRef.current = true;

    if (pinString === '100604') {
      setIsPinModalOpen(false);
      isVerifyingRef.current = false;

      const action = pendingAction;
      const data = pendingActionData;
      setPendingAction(null);
      setPendingActionData(null);

      if (action === 'edit') {
        const current = cookiesList.find(c => c.id === selectedId);
        if (current) {
          setEditSelectedId(current.id);
          setEditCookieName(current.name);
          setEditCookieRaw(current.raw);
          setIsEditModalOpen(true);
        }
      } else if (action === 'add') {
        setNewCookieName('');
        setNewCookieRaw('');
        setIsAddModalOpen(true);
      } else if (action === 'import-single') {
        fileInputRef.current?.click();
      } else if (action === 'import-bulk') {
        bulkFileInputRef.current?.click();
      } else if (action === 'export-bulk') {
        handleExportAll();
      } else if (action === 'open-link') {
        if (data) {
          window.open(data, '_blank');
        }
      }
    } else {
      await showAlert("Sai mã PIN! Vui lòng thử lại.", "Lỗi xác thực");
      setPin(['', '', '', '', '', '']);
      isVerifyingRef.current = false;
      const firstInput = document.getElementById('pin-input-0');
      if (firstInput) firstInput.focus();
    }
  };

  const handleCheckPastedCookie = async () => {
    const raw = checkCookieRaw.trim();
    if (!raw) {
      await showAlert("Vui lòng dán cookie vào ô nhập để kiểm tra.", "Thiếu thông tin");
      return;
    }

    const parsed = extractCookieDict(raw);
    if (!parsed || !parsed.NetflixId) {
      await showAlert("Không thể phân tích cookie hoặc cookie thiếu trường NetflixId.", "Lỗi phân tích");
      return;
    }

    const netflixId = parsed.NetflixId;
    const match = cookiesList.find(c => c.parsed && c.parsed.NetflixId === netflixId);

    if (match) {
      await showAlert(`Phát hiện TRÙNG LẶP! Cookie dán vào trùng với cấu hình: "${match.name}".`, "Kết quả kiểm tra");
      addLog(`Kiểm tra cookie dán: Trùng với cấu hình "${match.name}"`, "warning");
    } else {
      await showAlert("Tuyệt vời! Cookie dán vào KHÔNG trùng với bất kỳ cấu hình nào đã lưu.", "Kết quả kiểm tra");
      addLog("Kiểm tra cookie dán: Không trùng cấu hình nào", "success");
    }
  };

  const handleCheckAllSavedCookies = async () => {
    if (cookiesList.length === 0) {
      await showAlert("Không có cấu hình cookie nào để kiểm tra.", "Thông báo");
      return;
    }

    const idGroups = {};
    let hasDuplicate = false;

    for (const profile of cookiesList) {
      const netflixId = profile.parsed?.NetflixId;
      if (!netflixId) continue;
      if (!idGroups[netflixId]) {
        idGroups[netflixId] = [];
      }
      idGroups[netflixId].push(profile.name);
    }

    const dupDetails = [];
    for (const [netflixId, names] of Object.entries(idGroups)) {
      if (names.length > 1) {
        hasDuplicate = true;
        dupDetails.push(`- Trùng cookie NetflixId (${netflixId.substring(0, 15)}...): ${names.join(', ')}`);
      }
    }

    if (hasDuplicate) {
      const message = `Phát hiện các cấu hình bị trùng lặp cookie sau:\n\n${dupDetails.join('\n')}`;
      await showAlert(message, "Phát hiện trùng lặp");
      addLog("Kiểm tra tất cả cookie: Phát hiện trùng lặp!", "warning");
    } else {
      await showAlert("Tất cả các cấu hình cookie đã lưu đều duy nhất (Không có trùng lặp).", "Kết quả kiểm tra");
      addLog("Kiểm tra tất cả cookie: Không có trùng lặp", "success");
    }
  };

  const handleBulkGenerateAndCheck = async () => {
    if (cookiesList.length === 0) {
      await showAlert("Không có cấu hình cookie nào để kiểm tra hàng loạt.", "Thông báo");
      return;
    }

    const initialProgress = cookiesList.map(profile => ({
      id: profile.id,
      name: profile.name,
      netflixId: profile.parsed?.NetflixId || '',
      status: 'pending',
      link: '',
      error: ''
    }));

    setBulkProgress(initialProgress);
    setIsBulkModalOpen(true);
    setIsBulkGenerating(true);
    addLog(`Bắt đầu tạo & kiểm tra link hàng loạt cho ${cookiesList.length} tài khoản...`, "info");

    for (let i = 0; i < initialProgress.length; i++) {
      const item = initialProgress[i];
      setBulkProgress(prev => prev.map(p => p.id === item.id ? { ...p, status: 'checking' } : p));

      try {
        if (!item.netflixId) {
          throw new Error("Không có NetflixId cookie");
        }

        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ netflixId: item.netflixId }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || `Lỗi status ${response.status}`);
        }

        const { token } = data;
        if (!token) {
          throw new Error("Không trả về token");
        }

        const loginUrl = `https://netflix.com/?nftoken=${token}`;
        setBulkProgress(prev => prev.map(p => p.id === item.id ? { ...p, status: 'live', link: loginUrl } : p));
        addLog(`Tài khoản "${item.name}": SỐNG (Token generated)`, "success");
      } catch (err) {
        setBulkProgress(prev => prev.map(p => p.id === item.id ? { ...p, status: 'dead', error: err.message } : p));
        addLog(`Tài khoản "${item.name}": CHẾT (${err.message})`, "error");
      }

      await new Promise(r => setTimeout(r, 200));
    }

    setIsBulkGenerating(false);
    addLog("Đã hoàn thành kiểm tra hàng loạt.", "info");
  };



  const handlePinChange = (value, index) => {
    // Keep only numeric characters
    const digits = value.replace(/\D/g, '');
    
    const newPin = [...pin];
    if (digits.length === 0) {
      newPin[index] = '';
      setPin(newPin);
      return;
    }

    // Take the last digit if there are multiple (due to IME or fast typing)
    const lastDigit = digits.slice(-1);
    newPin[index] = lastDigit;
    setPin(newPin);

    // Auto-focus next input
    if (index < 5) {
      const nextInput = document.getElementById(`pin-input-${index + 1}`);
      if (nextInput) nextInput.focus();
    }

    // Auto-verify if this completes the 6 digits
    const pinString = newPin.join('');
    if (pinString.length === 6) {
      setTimeout(() => {
        verifyPin(newPin);
      }, 50);
    }
  };

  const handlePinKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      const newPin = [...pin];
      
      if (!pin[index] && index > 0) {
        newPin[index - 1] = '';
        setPin(newPin);
        const prevInput = document.getElementById(`pin-input-${index - 1}`);
        if (prevInput) {
          prevInput.focus();
        }
      } else {
        newPin[index] = '';
        setPin(newPin);
      }
    } else if (e.key === 'Enter') {
      if (pin.join('').length === 6) {
        verifyPin(pin);
      }
    }
  };

  const handlePinPaste = (e, index) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!pastedData) return;

    const newPin = [...pin];
    
    // Fill the pin boxes starting from the pasted index
    for (let i = 0; i < pastedData.length; i++) {
      if (index + i < 6) {
        newPin[index + i] = pastedData[i];
      }
    }
    setPin(newPin);

    // Focus the appropriate input after paste
    const nextFocusIndex = Math.min(index + pastedData.length, 5);
    const nextInput = document.getElementById(`pin-input-${nextFocusIndex}`);
    if (nextInput) nextInput.focus();

    // Auto-verify if this completes the 6 digits
    const pinString = newPin.join('');
    if (pinString.length === 6) {
      setTimeout(() => {
        verifyPin(newPin);
      }, 50);
    }
  };

  // File Upload (Browsing) handler
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const parsed = extractCookieDict(text);
      
      if (!parsed || !parsed.NetflixId) {
        addLog(`Failed to import cookie from file "${file.name}": NetflixId not found.`, "error");
        await showAlert(`Không thể nhập cookie từ file "${file.name}". Hãy đảm bảo file chứa cookie NetflixId hợp lệ.`, "Lỗi nhập file");
        return;
      }

      // Generate a default name from the file name without extension
      const defaultName = file.name.replace(/\.[^/.]+$/, "");
      
      const formattedRaw = generateNetscapeCookieString(parsed);

      const newProfile = {
        id: Date.now().toString(),
        name: defaultName,
        raw: formattedRaw,
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
        {/* Left Column: Cookie Management & Tools */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
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

            <div className="input-row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  setNewCookieName('');
                  setNewCookieRaw('');
                  setIsAddModalOpen(true);
                }}
                title="Add New Cookie Manually"
                style={{ flex: '1 1 auto' }}
              >
                + Add Cookie
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => fileInputRef.current?.click()}
                title="Browse text/JSON file"
                style={{ flex: '1 1 auto' }}
              >
                Import File
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={openEditModal}
                disabled={!currentProfile}
                title="Edit Raw Contents of Selected Profile"
                style={{ flex: '1 1 auto' }}
              >
                Edit File
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={handleDeleteCookie}
                disabled={!currentProfile}
                style={{ borderColor: '#552222', color: '#ff8888', flex: '1 1 auto' }}
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

            <div className="input-row" style={{ gap: '0.5rem', marginTop: '0.25rem' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => bulkFileInputRef.current?.click()}
                title="Nhập danh sách cấu hình từ file backup JSON"
                style={{ flex: 1 }}
              >
                Import Backup (Bulk)
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => requestPin('export-bulk')}
                title="Xuất toàn bộ danh sách cấu hình ra file JSON"
                style={{ flex: 1 }}
              >
                Export Backup (Bulk)
              </button>

              {/* Hidden File Input for Bulk Importing */}
              <input 
                type="file" 
                ref={bulkFileInputRef} 
                style={{ display: 'none' }} 
                accept=".json"
                onChange={handleBulkImportUpload} 
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

          {/* Cookie Tools & Duplicate Checker Card */}
          <section className="card" id="cookie-tools-section">
            <h2 className="card-title">Cookie Tools & Checker</h2>
            
            <div className="form-group">
              <label htmlFor="check-cookie-input">Dán cookie để kiểm tra trùng:</label>
              <textarea
                id="check-cookie-input"
                rows={4}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                placeholder="Dán nội dung cookie Netflix cần kiểm tra trùng lặp vào đây..."
                value={checkCookieRaw}
                onChange={(e) => setCheckCookieRaw(e.target.value)}
              />
              <button 
                className="btn btn-secondary"
                onClick={handleCheckPastedCookie}
                style={{ marginTop: '0.25rem' }}
              >
                Kiểm tra cookie dán
              </button>
            </div>

            <div className="input-row" style={{ gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                className="btn btn-secondary"
                onClick={handleCheckAllSavedCookies}
                style={{ flex: 1 }}
              >
                Kiểm tra tất cả cookie
              </button>
              <button
                className="btn btn-primary"
                onClick={handleBulkGenerateAndCheck}
                style={{ flex: 1 }}
              >
                Tạo & Kiểm tra hàng loạt
              </button>
            </div>
          </section>
        </div>

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
              <button 
                className="btn btn-primary" 
                onClick={() => window.open(tokenLink, '_blank')}
                disabled={!tokenLink}
              >
                Mở nhanh
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
                <label htmlFor="edit-cookie-select">Chọn cấu hình để sửa:</label>
                <select
                  id="edit-cookie-select"
                  value={editSelectedId}
                  onChange={(e) => handleSwitchEditProfile(e.target.value)}
                >
                  {cookiesList.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
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

      {/* PIN Verification Modal */}
      {isPinModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '380px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Xác thực quyền</h3>
              <button className="modal-close" onClick={() => setIsPinModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                Vui lòng nhập mã PIN gồm 6 chữ số để chỉnh sửa:
              </p>
              
              <div className="pin-inputs-container">
                {pin.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`pin-input-${idx}`}
                    type="tel"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    className="pin-input"
                    onChange={(e) => handlePinChange(e.target.value, idx)}
                    onKeyDown={(e) => handlePinKeyDown(e, idx)}
                    onPaste={(e) => handlePinPaste(e, idx)}
                    autoComplete="off"
                  />
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsPinModalOpen(false)}>Hủy</button>
              <button 
                className="btn btn-primary" 
                onClick={() => verifyPin(pin)}
                disabled={pin.join('').length < 6}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert/Confirm Modal */}
      {alertModal.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: alertModal.type === 'confirm' ? 'var(--accent)' : 'var(--text-main)' }}>
                {alertModal.title}
              </h3>
              <button 
                className="modal-close" 
                onClick={() => {
                  if (alertModal.onCancel) alertModal.onCancel();
                  else alertModal.onConfirm();
                }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-sub)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                {alertModal.message}
              </p>
            </div>
            <div className="modal-footer">
              {alertModal.type === 'confirm' && (
                <button 
                  className="btn btn-secondary" 
                  onClick={() => {
                    if (alertModal.onCancel) alertModal.onCancel();
                  }}
                >
                  Hủy
                </button>
              )}
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  if (alertModal.onConfirm) alertModal.onConfirm();
                }}
                style={{ minWidth: '80px' }}
              >
                {alertModal.type === 'confirm' ? 'Đồng ý' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Generate & Check Modal */}
      {isBulkModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1500 }}>
          <div className="modal-content" style={{ maxWidth: '800px', width: '95%' }}>
            <div className="modal-header">
              <h3 className="modal-title">Tạo & Kiểm Tra Link Hàng Loạt</h3>
              <button className="modal-close" onClick={() => setIsBulkModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>
                Hệ thống đang tiến hành tạo token link và kiểm tra trạng thái hoạt động của các cookie Netflix đã lưu.
              </p>
              
              <div className="bulk-table-container" style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--card-border)', borderRadius: '8px' }}>
                <table className="bulk-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--card-border)' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Tên cấu hình</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Trạng thái</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkProgress.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>{item.name}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          {item.status === 'pending' && <span style={{ color: 'var(--text-muted)' }}>Chờ...</span>}
                          {item.status === 'checking' && <span style={{ color: 'var(--accent)', animation: 'pulse 1s infinite' }}>Đang kiểm tra...</span>}
                          {item.status === 'live' && <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>✓ SỐNG (Live)</span>}
                          {item.status === 'dead' && (
                            <span style={{ color: 'var(--error)' }} title={item.error}>
                              ✗ CHẾT (Dead)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          {item.status === 'live' && (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', minHeight: 'auto' }}
                                onClick={() => {
                                  navigator.clipboard.writeText(item.link);
                                  addLog(`Đã copy link tài khoản "${item.name}"`, "success");
                                }}
                              >
                                Copy
                              </button>
                              <button 
                                className="btn btn-primary" 
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', minHeight: 'auto' }}
                                onClick={() => window.open(item.link, '_blank')}
                              >
                                Mở nhanh
                              </button>
                            </div>
                          )}
                          {item.status === 'dead' && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{item.error || 'Thử lại sau'}</span>
                          )}
                          {(item.status === 'pending' || item.status === 'checking') && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => setIsBulkModalOpen(false)}
                disabled={isBulkGenerating}
              >
                Đóng
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleBulkGenerateAndCheck}
                disabled={isBulkGenerating}
              >
                {isBulkGenerating ? 'Đang chạy...' : 'Kiểm tra lại'}
              </button>
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
