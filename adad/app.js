document.addEventListener('DOMContentLoaded', () => {
  console.log('jbinx.kr URL Shortener - App version 1.2 loaded');
  // DOM Elements
  const form = document.getElementById('shorten-form');
  const destUrlInput = document.getElementById('dest-url');
  const customSlugInput = document.getElementById('custom-slug');
  const previewSlug = document.getElementById('preview-slug');
  const previewDomain = document.getElementById('preview-domain');
  const submitBtn = document.getElementById('submit-btn');
  const linksList = document.getElementById('links-list');
  const urlErrorMsg = document.getElementById('url-error');
  const slugErrorMsg = document.getElementById('slug-error');
  const toastContainer = document.getElementById('toast-container');
  const inputPrefix = document.querySelector('.input-prefix');

  // Domain logic: Default to jbinx.kr if running locally, otherwise use current host
  const hostname = window.location.hostname;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('192.168.') || hostname === '';
  const displayHost = isLocal ? 'jbinx.kr' : window.location.host;
  const displayOrigin = isLocal ? 'https://jbinx.kr' : window.location.origin;

  // Initialize UI texts with domain
  if (inputPrefix) inputPrefix.textContent = `${displayHost}/`;
  if (previewDomain) previewDomain.textContent = `${displayOrigin}/`;

  // Check URL parameters for redirection errors
  const urlParams = new URLSearchParams(window.location.search);
  const errorParam = urlParams.get('error');
  const errorSlug = urlParams.get('slug');
  
  if (errorParam === 'not-found' && errorSlug) {
    showToast(`단축 링크 '${decodeURIComponent(errorSlug)}'을(를) 찾을 수 없습니다. 원래 링크가 존재하지 않거나 만료되었습니다.`, true);
    // Clear query parameter from URL bar without refreshing
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Real-time Slug Preview & Sanitization
  customSlugInput.addEventListener('input', (e) => {
    let value = e.target.value;
    
    // Sanitize input: allow alphabetic, numeric, hyphen, underscore, and Korean
    const sanitized = value.replace(/[^a-zA-Z0-9-_\u3131-\uD79D]/g, '');
    if (value !== sanitized) {
      e.target.value = sanitized;
      value = sanitized;
      showInputError(customSlugInput, slugErrorMsg, true);
    } else {
      showInputError(customSlugInput, slugErrorMsg, false);
    }

    if (value.trim() === '') {
      previewSlug.textContent = '이름';
      previewSlug.classList.add('preview-placeholder');
    } else {
      previewSlug.classList.remove('preview-placeholder');
      previewSlug.textContent = value;
    }
  });

  // Reset errors on input
  destUrlInput.addEventListener('input', () => {
    showInputError(destUrlInput, urlErrorMsg, false);
  });

  // Form Submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const destUrl = destUrlInput.value.trim();
    let rawSlug = customSlugInput.value.trim();

    // 1. Validation
    let isValid = true;

    // Validate URL
    if (!isValidUrl(destUrl)) {
      showInputError(destUrlInput, urlErrorMsg, true);
      isValid = false;
    }

    // Validate Slug
    if (!rawSlug) {
      showInputError(customSlugInput, slugErrorMsg, true);
      isValid = false;
    }

    if (!isValid) return;

    // Use the raw slug without modification
    const slug = rawSlug;

    // 2. Disable Submit Button and show loading
    submitBtn.disabled = true;
    const originalBtnHTML = submitBtn.innerHTML;
    submitBtn.innerHTML = `
      <span>단축 링크 생성 중...</span>
      <svg class="spinner" width="18" height="18" viewBox="0 0 50 50" style="animation: spin 1s linear infinite;">
        <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" stroke-dasharray="80, 200"></circle>
      </svg>
    `;

    try {
      // Send API request to Cloudflare Pages Function
      const response = await fetch('/shorten', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: destUrl,
          name: slug
        })
      });

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const result = await response.json();

        if (response.ok) {
          // Success
          const generatedShortUrl = `${displayOrigin}/${result.slug}`;
          
          // Save to local storage
          saveLink(generatedShortUrl, destUrl, result.slug);
          
          // Render recent links
          renderRecentLinks();
          
          // Reset form
          form.reset();
          previewSlug.textContent = '이름';
          previewSlug.classList.add('preview-placeholder');
          
          showToast('🎉 단축 링크가 성공적으로 등록되었습니다!');
        } else {
          // Handle server errors (e.g. KV not bound or duplicate)
          showToast(result.error || `서버 오류 (${response.status})`, true);
        }
      } else {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        showToast(`서버에서 잘못된 응답을 반환했습니다. (상태 코드: ${response.status}) 응답: ${text.slice(0, 50)}`, true);
      }
    } catch (error) {
      console.error('Request error:', error);
      if (window.location.protocol === 'file:') {
        showToast('로컬 파일(file://) 환경에서는 단축 생성 기능(API)을 사용할 수 없습니다. Cloudflare Pages에 배포 후 테스트해주세요.', true);
      } else {
        showToast(`통신 오류: ${error.message}`, true);
      }
    } finally {
      // Restore submit button
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHTML;
    }
  });

  // --- Helper Functions ---

  // URL Validation
  function isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  // Show/Hide input error style
  function showInputError(inputEl, errorEl, isError) {
    if (isError) {
      inputEl.classList.add('error');
      errorEl.style.display = 'block';
    } else {
      inputEl.classList.remove('error');
      errorEl.style.display = 'none';
    }
  }

  // Toast system
  function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'toast-error' : ''}`;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    // Trigger animation frame
    requestAnimationFrame(() => {
      toastContainer.classList.add('show');
    });

    // Remove toast after 3.5 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      toast.style.transition = 'opacity 300ms, transform 300ms';
      
      setTimeout(() => {
        toast.remove();
        if (toastContainer.children.length === 0) {
          toastContainer.classList.remove('show');
        }
      }, 300);
    }, 3500);
  }

  // Copy to clipboard helper
  window.copyLink = function(text, event) {
    if (event) event.preventDefault();
    
    navigator.clipboard.writeText(text).then(() => {
      showToast('📋 단축 주소가 클립보드에 복사되었습니다!');
    }).catch(err => {
      console.error('Copy failed:', err);
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        showToast('📋 단축 주소가 클립보드에 복사되었습니다!');
      } catch (e) {
        showToast('클립보드 복사에 실패했습니다.', true);
      }
      document.body.removeChild(textArea);
    });
  };

  // Local Storage management
  function getRecentLinks() {
    const data = localStorage.getItem('jbinx_recent_links');
    return data ? JSON.parse(data) : [];
  }

  function saveLink(shortUrl, destUrl, slug) {
    const links = getRecentLinks();
    
    // Check if slug already exists in recent links list, and update or move to top
    const filteredLinks = links.filter(link => link.slug !== slug);
    
    filteredLinks.unshift({ shortUrl, destUrl, slug, timestamp: Date.now() });
    
    // Keep max 10 links
    if (filteredLinks.length > 10) {
      filteredLinks.pop();
    }
    
    localStorage.setItem('jbinx_recent_links', JSON.stringify(filteredLinks));
  }

  window.deleteLink = function(slug) {
    const links = getRecentLinks();
    const filtered = links.filter(link => link.slug !== slug);
    localStorage.setItem('jbinx_recent_links', JSON.stringify(filtered));
    renderRecentLinks();
    showToast('목록에서 링크가 삭제되었습니다.');
  };

  function renderRecentLinks() {
    const links = getRecentLinks();
    
    if (links.length === 0) {
      linksList.innerHTML = `
        <p class="text-center body-sm" style="padding: var(--space-xl) 0; color: var(--color-stone);">생성된 단축 링크가 없습니다. 위 폼을 통해 링크를 단축해 보세요!</p>
      `;
      return;
    }

    linksList.innerHTML = links.map(link => `
      <div class="link-item">
        <div class="link-info">
          <a href="${link.shortUrl}" class="link-short" target="_blank" onclick="copyLink('${link.shortUrl}', event)">
            ${link.shortUrl.replace(/^https?:\/\//, '')}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-steel);"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </a>
          <span class="link-dest" title="${escapeHtml(link.destUrl)}">${escapeHtml(link.destUrl)}</span>
        </div>
        <div class="link-actions">
          <!-- Copy Button -->
          <button class="icon-btn" onclick="copyLink('${link.shortUrl}')" title="링크 복사">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-copy"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>
          <!-- Delete Button -->
          <button class="icon-btn" onclick="deleteLink('${link.slug}')" title="목록에서 삭제" style="color: var(--color-critical-strong); border-color: rgba(240, 40, 74, 0.1);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-trash-2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        </div>
      </div>
    `).join('');
  }

  // Escape HTML helper to prevent XSS
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // CSS for spinner keyframe inject (since we don't have custom keyframes in main CSS yet)
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleSheet);

  // Initial load
  renderRecentLinks();
});
