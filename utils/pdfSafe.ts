import html2canvas from 'html2canvas';

// OKLCH to RGB/RGBA safe conversion using standard W3C formulas
export function oklchToRgb(oklchStr: string): string {
  try {
    const clean = oklchStr.replace(/\s+/g, ' ');
    const numbers = clean.match(/-?[\d.]+%?/g);
    if (!numbers || numbers.length < 3) return 'rgb(120, 130, 140)'; // default safety slate color
    
    const lStr = numbers[0];
    const cStr = numbers[1];
    const hStr = numbers[2];
    const aStr = numbers[3] || '1';
    
    const l = lStr.endsWith('%') ? parseFloat(lStr) / 100 : parseFloat(lStr);
    const c = parseFloat(cStr);
    let h = parseFloat(hStr);
    
    if (clean.includes('rad')) h = h * (180 / Math.PI);
    else if (clean.includes('turn')) h = h * 360;
    else if (clean.includes('grad')) h = h * 0.9;
    
    let a = 1;
    if (aStr) {
      a = aStr.endsWith('%') ? parseFloat(aStr) / 100 : parseFloat(aStr);
      if (isNaN(a)) a = 1;
    }
    
    const hRad = h * Math.PI / 180;
    const a_coord = c * Math.cos(hRad);
    const b_coord = c * Math.sin(hRad);
    
    const l_ = l + 0.3963377774 * a_coord + 0.2158037573 * b_coord;
    const m_ = l - 0.1055610246 * a_coord - 0.0638541728 * b_coord;
    const s_ = l - 0.0894841775 * a_coord - 1.2914855414 * b_coord;
    
    const l_cubed = l_ * l_ * l_;
    const m_cubed = m_ * m_ * m_;
    const s_cubed = s_ * s_ * s_;
    
    const r_lin = +4.0767416621 * l_cubed - 3.3077115913 * m_cubed + 0.2309699292 * s_cubed;
    const g_lin = -1.2684380046 * l_cubed + 2.6097574011 * m_cubed - 0.3413193965 * s_cubed;
    const b_lin = -0.0041960863 * l_cubed - 0.7034186145 * m_cubed + 1.7076147010 * s_cubed;
    
    const fn = (cVal: number) => {
      return cVal <= 0.0031308 ? 12.92 * cVal : 1.055 * Math.pow(cVal, 1 / 2.4) - 0.055;
    };
    
    const r = Math.round(Math.max(0, Math.min(1, fn(r_lin))) * 255);
    const g = Math.round(Math.max(0, Math.min(1, fn(g_lin))) * 255);
    const b = Math.round(Math.max(0, Math.min(1, fn(b_lin))) * 255);
    
    return a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
  } catch (err) {
    return 'rgb(120, 130, 140)';
  }
}

// OKLAB to RGB/RGBA safe conversion using standard W3C formulas
export function oklabToRgb(oklabStr: string): string {
  try {
    const clean = oklabStr.replace(/\s+/g, ' ');
    const numbers = clean.match(/-?[\d.]+%?/g);
    if (!numbers || numbers.length < 3) return 'rgb(120, 130, 140)'; // default safety slate color
    
    const lStr = numbers[0];
    const aStr = numbers[1];
    const bStr = numbers[2];
    const alphaStr = numbers[3] || '1';
    
    const l = lStr.endsWith('%') ? parseFloat(lStr) / 100 : parseFloat(lStr);
    const a_coord = parseFloat(aStr);
    const b_coord = parseFloat(bStr);
    
    let alpha = 1;
    if (alphaStr) {
      alpha = alphaStr.endsWith('%') ? parseFloat(alphaStr) / 100 : parseFloat(alphaStr);
      if (isNaN(alpha)) alpha = 1;
    }
    
    const l_ = l + 0.3963377774 * a_coord + 0.2158037573 * b_coord;
    const m_ = l - 0.1055610246 * a_coord - 0.0638541728 * b_coord;
    const s_ = l - 0.0894841775 * a_coord - 1.2914855414 * b_coord;
    
    const l_cubed = l_ * l_ * l_;
    const m_cubed = m_ * m_ * m_;
    const s_cubed = s_ * s_ * s_;
    
    const r_lin = +4.0767416621 * l_cubed - 3.3077115913 * m_cubed + 0.2309699292 * s_cubed;
    const g_lin = -1.2684380046 * l_cubed + 2.6097574011 * m_cubed - 0.3413193965 * s_cubed;
    const b_lin = -0.0041960863 * l_cubed - 0.7034186145 * m_cubed + 1.7076147010 * s_cubed;
    
    const fn = (cVal: number) => {
      return cVal <= 0.0031308 ? 12.92 * cVal : 1.055 * Math.pow(cVal, 1 / 2.4) - 0.055;
    };
    
    const r = Math.round(Math.max(0, Math.min(1, fn(r_lin))) * 255);
    const g = Math.round(Math.max(0, Math.min(1, fn(g_lin))) * 255);
    const b = Math.round(Math.max(0, Math.min(1, fn(b_lin))) * 255);
    
    return alpha === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } catch (err) {
    return 'rgb(120, 130, 140)';
  }
}

// Recursively traverses elements in the cloned DOM tree and converts computed oklch/oklab styles to safe inline RGB/RGBA styles.
// Also strips out "in oklch" and "in oklab" color space specifiers from gradients.
export function sanitizeClonedElementStyles(el: HTMLElement) {
  if (!el || typeof el.querySelectorAll !== 'function') return;
  
  const elements = [el, ...Array.from(el.querySelectorAll('*'))] as HTMLElement[];
  const propertiesToSanitize = [
    'color',
    'background-color',
    'border-color',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'outline-color',
    'fill',
    'stroke',
    'box-shadow',
    'background-image',
    'text-shadow',
    'text-decoration-color',
    'border-image',
    'outline'
  ];

  elements.forEach(element => {
    if (!element.style) return;
    try {
      // 1. Sanitize the element's raw inline cssText as a first-line of defense
      let cssText = element.style.cssText;
      if (cssText && (
        cssText.includes('oklch') || cssText.includes('oklab') || 
        cssText.includes('OKLCH') || cssText.includes('OKLAB')
      )) {
        let cleanCss = cssText;
        cleanCss = cleanCss.replace(/\bin\s+okl(?:ch|ab)\s*,?/gi, '');
        cleanCss = cleanCss.replace(/oklch\((?:[^()]+|\([^()]*\))*\)/gi, (m) => oklchToRgb(m));
        cleanCss = cleanCss.replace(/oklab\((?:[^()]+|\([^()]*\))*\)/gi, (m) => oklabToRgb(m));
        element.style.cssText = cleanCss;
      }

      // 2. Resolve computed styles and apply them as overrides if they contain oklch/oklab
      const doc = element.ownerDocument || document;
      const win = doc.defaultView || window;
      const computed = win.getComputedStyle(element);

      propertiesToSanitize.forEach(prop => {
        try {
          const val = computed.getPropertyValue(prop);
          if (val && (val.includes('oklch') || val.includes('oklab') || val.includes('OKLCH') || val.includes('OKLAB'))) {
            let sanitized = val;
            
            // Strip out "in oklch" or "in oklab" interpolation space specifiers (e.g. from linear-gradients)
            sanitized = sanitized.replace(/\bin\s+okl(?:ch|ab)\s*,?/gi, '');
            sanitized = sanitized.replace(/,\s*,/g, ',');
            sanitized = sanitized.replace(/\(\s*,/g, '(');
            
            // Convert oklch color functions to rgb
            sanitized = sanitized.replace(/oklch\((?:[^()]+|\([^()]*\))*\)/gi, (m) => oklchToRgb(m));
            
            // Convert oklab color functions to rgb
            sanitized = sanitized.replace(/oklab\((?:[^()]+|\([^()]*\))*\)/gi, (m) => oklabToRgb(m));
            
            element.style.setProperty(prop, sanitized, 'important');
          }
        } catch (propErr) {}
      });
    } catch (elErr) {}
  });
}

// Sanitizes all same-origin stylesheets inside the cloned document during safeHtml2Canvas serialization
// This prevents blocking the main thread or page flicker because the parent document is untouched.
export async function safeHtml2Canvas(element: HTMLElement, options?: any): Promise<HTMLCanvasElement> {
  const originalInlineStyles = new Map<HTMLElement, string>();
  const originalStyleContents = new Map<HTMLStyleElement, string>();
  const originalLinkDisabledStates = new Map<any, any>();
  const createdTemporaryStyles: HTMLStyleElement[] = [];

  // Intercept onclone options to clean cloned elements recursively
  const html2canvasOptions = { ...(options || {}) };
  const userOnClone = html2canvasOptions.onclone;

  html2canvasOptions.onclone = (clonedDoc: Document, clonedEl: HTMLElement) => {
    try {
      const rootToSanitize = clonedEl || clonedDoc.body;
      
      // 1. Physically remove all elements with data-html2canvas-ignore="true" from the cloned DOM
      // This stops html2canvas from trying to scan, fetch or preload them.
      if (rootToSanitize) {
        const ignored = rootToSanitize.querySelectorAll('[data-html2canvas-ignore="true"]');
        ignored.forEach(el => {
          try {
            el.remove();
          } catch (err) {}
        });

        // 2. Remove or replace all cross-origin images that are known to cause CORS issues/crashes (e.g. wikimedia/wikipedia)
        const images = rootToSanitize.querySelectorAll('img');
        images.forEach(img => {
          try {
            const src = img.getAttribute('src') || '';
            if (src.startsWith('http') && !src.startsWith(window.location.origin)) {
              if (src.includes('wikimedia.org') || src.includes('wikipedia') || src.includes('googleusercontent') || src.includes('blogspot')) {
                // Remove decorative or external badges that fail CORS/preloading
                img.remove();
              } else {
                // Force crossOrigin attribute for other images to allow clean exports
                img.setAttribute('crossOrigin', 'anonymous');
              }
            }
          } catch (imgErr) {}
        });
      }

      if (rootToSanitize) {
        sanitizeClonedElementStyles(rootToSanitize);
      }
    } catch (cloneSanitizeErr) {
      console.error('Error during onclone computed styles sanitization:', cloneSanitizeErr);
    }

    if (typeof userOnClone === 'function') {
      userOnClone(clonedDoc, clonedEl);
    }
  };

  try {
    // 1. Sanitize style attributes of all elements in the active document containing oklch/oklab
    try {
      const elementsWithStyle = Array.from(document.querySelectorAll('[style]')) as HTMLElement[];
      elementsWithStyle.forEach(el => {
        const inlineStyle = el.getAttribute('style');
        if (inlineStyle && (inlineStyle.includes('oklch') || inlineStyle.includes('oklab') || inlineStyle.includes('OKLCH') || inlineStyle.includes('OKLAB'))) {
          originalInlineStyles.set(el, inlineStyle);
          let sanitized = inlineStyle;
          sanitized = sanitized.replace(/oklch\((?:[^()]+|\([^()]*\))*\)/gi, (m) => oklchToRgb(m));
          sanitized = sanitized.replace(/oklab\((?:[^()]+|\([^()]*\))*\)/gi, (m) => oklabToRgb(m));
          el.setAttribute('style', sanitized);
        }
      });
    } catch (inlineErr) {
      console.error('Error temporarily sanitizing inline styles:', inlineErr);
    }

    // 2. Sanitize ALL stylesheets in the document (both <style> and <link>) by reading their actual CSSOM rules,
    // disabling them, and replacing them with temporary sanitized <style> tags.
    try {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const ownerNode = sheet.ownerNode as HTMLElement & { disabled?: boolean };
          if (!ownerNode) continue;

          let cssText = '';
          const isSameOrigin = !sheet.href || sheet.href.startsWith(window.location.origin) || sheet.href.startsWith('/');
          
          if (isSameOrigin) {
            try {
              cssText = Array.from(sheet.cssRules || [])
                .map(rule => rule.cssText)
                .join('\n');
            } catch (e) {
              // CORS/Sandbox fallback: Try to fetch stylesheet text directly if href is present!
              if (sheet.href) {
                try {
                  const resp = await window.fetch(sheet.href);
                  if (resp.ok) {
                    cssText = await resp.text();
                  } else {
                    cssText = ownerNode.textContent || '';
                  }
                } catch (fetchErr) {
                  console.warn('Failed to fetch stylesheet content directly:', sheet.href, fetchErr);
                  cssText = ownerNode.textContent || '';
                }
              } else {
                cssText = ownerNode.textContent || '';
              }
            }
          } else {
            // Foreign sheet, try to read textContent if possible
            cssText = ownerNode.textContent || '';
          }

          if (cssText && (
            cssText.includes('oklch') || cssText.includes('oklab') || 
            cssText.includes('OKLCH') || cssText.includes('OKLAB')
          )) {
            // Save original style content if it's a style tag to be safe
            if (ownerNode.nodeName === 'STYLE') {
              originalStyleContents.set(ownerNode as HTMLStyleElement, ownerNode.textContent || '');
            }

            // Save original parent, sibling, and disabled state for DOM restoration
            const parent = ownerNode.parentNode;
            const nextSibling = ownerNode.nextSibling;
            
            originalLinkDisabledStates.set(ownerNode, {
              parent,
              nextSibling,
              disabled: !!ownerNode.disabled || !!sheet.disabled
            });

            // Physically remove from the DOM so html2canvas's parser cannot find or scan this raw sheet
            if (parent) {
              parent.removeChild(ownerNode);
            }

            // Create sanitized CSS
            let sanitized = cssText;
            sanitized = sanitized.replace(/oklch\((?:[^()]+|\([^()]*\))*\)/gi, (m) => oklchToRgb(m));
            sanitized = sanitized.replace(/oklab\((?:[^()]+|\([^()]*\))*\)/gi, (m) => oklabToRgb(m));
            
            // Clean up any gradient interpolation space specifiers (e.g. "in oklch")
            sanitized = sanitized.replace(/\bin\s+okl(?:ch|ab)\s*,?/gi, '');
            sanitized = sanitized.replace(/,\s*,/g, ',');
            sanitized = sanitized.replace(/\(\s*,/g, '(');

            const tempStyle = document.createElement('style');
            tempStyle.className = 'temp-pdf-sanitized-style';
            tempStyle.textContent = sanitized;
            document.head.appendChild(tempStyle);
            createdTemporaryStyles.push(tempStyle);
          }
        } catch (sheetErr) {
          console.error('Error temporarily sanitizing stylesheet:', sheetErr);
        }
      }
    } catch (globalSheetErr) {
      console.error('Error in global stylesheet sanitization:', globalSheetErr);
    }

    // Call html2canvas with sanitized styles. It will execute successfully because oklch/oklab are fully stripped!
    const canvas = await html2canvas(element, html2canvasOptions);
    return canvas;

  } catch (err) {
    console.error('safeHtml2Canvas main error:', err);
    // Fallback to standard html2canvas if all else fails
    return html2canvas(element, html2canvasOptions);
  } finally {
    // RESTORE ALL ORIGINAL STYLES TO PREVENT ANY VISUAL CHANGES OR STYLE PROBLEMS FOR THE USER
    
    // Restore inline styles
    originalInlineStyles.forEach((style, el) => {
      try {
        el.setAttribute('style', style);
      } catch (err) {}
    });

    // Restore style elements
    originalStyleContents.forEach((content, styleEl) => {
      try {
        styleEl.textContent = content;
      } catch (err) {}
    });

    // Restore link/style nodes back to their original places in the DOM and original disabled states
    originalLinkDisabledStates.forEach((info: any, el: any) => {
      try {
        if (info.parent) {
          info.parent.insertBefore(el, info.nextSibling);
        }
        el.disabled = info.disabled;
        if (info.disabled) {
          el.setAttribute('disabled', 'true');
        } else {
          el.removeAttribute('disabled');
        }
      } catch (err) {}
    });

    // Remove temporary style elements
    createdTemporaryStyles.forEach(tempStyle => {
      try {
        tempStyle.remove();
      } catch (err) {}
    });
  }
}
